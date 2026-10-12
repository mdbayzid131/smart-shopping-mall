/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { Issue } from './issue.model';
import { Product } from '../product/product.model';
import { Order } from '../order/order.model';
import { User } from '../user/user.model';
import { ORDER_OUTCOME, ORDER_STATUS } from '../../../enums/order';
import { emailHelper } from '../../../helpers/emailHelper';
import { emailTemplate } from '../../../shared/emailTemplate';
import { errorLogger } from '../../../shared/logger';
import { deleteFromS3 } from '../../../helpers/s3Helper';
import {
  invalidateProductListCache,
  synchronizeProductStatusMutation,
} from '../product/product-state-sync';
import { NotificationEvent } from '../notification/notification.event';
import { Wishlist } from '../wishlist/wishlist.model';
import { OrderService } from '../order/order.service';
import { UserPenaltyService } from '../user/user-penalty.service';
import { ISSUE_TYPE } from '../../../enums/issue';

const defaultIssueReason = (
  issueType: ISSUE_TYPE,
  outcome: ORDER_OUTCOME,
) => {
  const reasons: Partial<Record<ORDER_OUTCOME, string>> = {
    [ORDER_OUTCOME.AUTHENTICATION_FAILED]:
      'Authentication mismatch detected',
    [ORDER_OUTCOME.COUNTERFEIT]: 'Counterfeit item detected',
    [ORDER_OUTCOME.SELLER_UNAVAILABLE]:
      'Seller could not complete collection',
    [ORDER_OUTCOME.BUYER_CHANGED_MIND]:
      'Buyer changed their mind at delivery',
    [ORDER_OUTCOME.NOT_AS_DESCRIBED]:
      'Buyer reported that the item was not as described',
    [ORDER_OUTCOME.CONDITION_DIFFERS]:
      'Buyer reported that the item condition differed from the listing',
    [ORDER_OUTCOME.OTHERS]: 'Buyer rejected the item for another reason',
  };

  if (issueType === ISSUE_TYPE.OTHERS) return '';
  return reasons[outcome] ?? 'Issue reported by an administrator';
};

const createIssue = async (
  productId: string | undefined,
  orderId: string | undefined,
  issueType: ISSUE_TYPE,
  outcome: ORDER_OUTCOME,
  reason: string | undefined,
  adminId: string,
) => {
  let order: any = null;
  if (orderId) {
    order = await Order.findById(orderId);
  }

  const effectiveProductId =
    productId || order?.product?._id?.toString() || order?.product?.toString();

  if (!effectiveProductId && !order) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Product ID or Order ID is required');
  }

  const product = effectiveProductId
    ? await Product.findById(effectiveProductId)
    : null;

  if (!order && effectiveProductId) {
    order = await Order.findOne({ product: effectiveProductId }).sort({ createdAt: -1 });
  }

  if (!product && !order) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Product or Order not found');
  }

  // Prevent reporting issues on delivered, completed, or already refunded/cancelled orders
  if (order) {
    if (
      order.status === ORDER_STATUS.DELIVERED ||
      order.status === ORDER_STATUS.COMPLETED
    ) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Cannot report an issue on an order that has already been delivered or completed',
      );
    }
    if (
      order.status === ORDER_STATUS.REFUNDED ||
      order.status === ORDER_STATUS.CANCELLED
    ) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Cannot report an issue on an order that is already cancelled or refunded',
      );
    }
  }

  const effectiveReason =
    reason?.trim() || defaultIssueReason(issueType, outcome);

  // Check for existing unresolved issue for product
  if (effectiveProductId) {
    const existingIssue = await Issue.findOne({
      product: effectiveProductId,
      resolved: false,
    });
    if (existingIssue && issueType !== ISSUE_TYPE.SELLER_UNAVAILABLE) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'An unresolved issue already exists for this product',
      );
    }
  }

  let refunded = false;
  if (order) {
    order = await OrderService.updateOrderStatus(
      order._id.toString(),
      ORDER_STATUS.REFUNDED,
      effectiveReason,
      adminId,
      outcome,
      false,
    );
    refunded = true;

    if (issueType === ISSUE_TYPE.SELLER_UNAVAILABLE) {
      const sellerIdStr =
        order?.seller?._id?.toString() || order?.seller?.toString();
      if (sellerIdStr) {
        await UserPenaltyService.recordMissedCollection(sellerIdStr);
      }
    }
  }

  const buyerId = order?.buyer?._id || order?.buyer || product?.buyer;
  const sellerId = order?.seller?._id || order?.seller || product?.seller;

  // Create issue
  const issue = await Issue.create({
    order: order?._id,
    orderNumber: order?.orderNumber,
    product: effectiveProductId || order?.product,
    buyer: buyerId,
    seller: sellerId,
    issueType,
    outcome,
    reason: effectiveReason,
    admin: adminId,
    resolved: false,
  });

  // Notify seller
  const seller = sellerId ? await User.findById(sellerId) : null;
  if (seller && seller.email) {
    try {
      const emailData = emailTemplate.issueCreated({
        email: seller.email,
        productName: product?.name || 'Item',
        issueType,
        reason: effectiveReason,
        refunded,
      });
      await emailHelper.sendEmail(emailData);
    } catch (emailErr) {
      errorLogger.error('Failed to send issueCreated email:', emailErr);
    }
  }

  return issue;
};


const resolveIssue = async (
  issueId: string,
  action: 'delete' | 'make_available',
  adminId: string,
) => {
  const issue = await Issue.findById(issueId).populate('product');
  if (!issue) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Issue not found');
  }
  if (issue.resolved) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Issue already resolved');
  }

  const product = await Product.findById(issue.product);
  if (!product) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Product not found');
  }

  const seller = await User.findById(product.seller);
  const order = await Order.findOne({ product: product._id }).sort({
    createdAt: -1,
  });
  const watcherIds = await Wishlist.distinct('user', { product: product._id });

  if (action === 'delete') {
    // Soft-delete / Unlist product: update status to 'rejected' so it's permanently removed from active feeds and marketplace
    await synchronizeProductStatusMutation(
      Product.findByIdAndUpdate(product._id, {
        $set: { status: 'rejected' },
        $unset: { buyer: 1, reservationExpiresAt: 1 },
      }),
      { productId: product._id.toString(), status: 'rejected' },
    );

    // Clean up wishlist
    await Wishlist.deleteMany({ product: product._id });
    void Promise.all(
      watcherIds.map(watcherId =>
        NotificationEvent.wishlistItemUnavailable(
          watcherId.toString(),
          product._id.toString(),
          product.name,
        ),
      ),
    );

    // Notify seller
    if (seller && seller.email) {
      try {
        const emailData = emailTemplate.issueResolved({
          email: seller.email,
          productName: product.name,
          action: 'delete',
        });
        await emailHelper.sendEmail(emailData);
      } catch (emailErr) {
        errorLogger.error('Failed to send issueResolved (delete) email:', emailErr);
      }
    }
  } else if (action === 'make_available') {
    // Update product status and clear buyer
    await synchronizeProductStatusMutation(
      Product.findByIdAndUpdate(product._id, {
        $set: { status: 'live' },
        $unset: { buyer: 1, reservationExpiresAt: 1 },
      }),
      { productId: product._id.toString(), status: 'live' },
    );
    void NotificationEvent.wishlistAvailabilityChanged(
      product._id.toString(),
      true,
      `issue:${issue._id.toString()}:resolved`,
    );

    // Notify seller
    if (seller && seller.email) {
      try {
        const emailData = emailTemplate.issueResolved({
          email: seller.email,
          productName: product.name,
          action: 'make_available',
        });
        await emailHelper.sendEmail(emailData);
      } catch (emailErr) {
        errorLogger.error('Failed to send issueResolved (make_available) email:', emailErr);
      }
    }
  }

  // Mark issue as resolved
  issue.resolved = true;
  await issue.save();
  if (order) {
    if (order.status !== ORDER_STATUS.REFUNDED && order.status !== ORDER_STATUS.CANCELLED) {
      order.status = ORDER_STATUS.REFUNDED;
      order.statusHistory.push({
        status: ORDER_STATUS.REFUNDED,
        changedAt: new Date(),
      });
      await order.save();
    }
    void NotificationEvent.issueResolved(issue._id.toString(), order);
  }

  // Clear product cache
  invalidateProductListCache();

  return issue;
};

const sanitizeAndEnrichIssue = async (issue: any) => {
  if (!issue) return issue;

  // 1. Completely remove 4-digit orderId from response
  delete issue.orderId;
  if (issue.product && typeof issue.product === 'object') {
    delete issue.product.orderId;
  }

  // 2. Ensure orderNumber is set
  if (issue.order && typeof issue.order === 'object' && issue.order.orderNumber) {
    issue.orderNumber = issue.orderNumber || issue.order.orderNumber;
  }

  if (!issue.orderNumber && issue.product) {
    const prodId = issue.product._id || issue.product;
    const matchedOrder = await Order.findOne({ product: prodId })
      .sort({ createdAt: -1 })
      .select('_id orderNumber');
    if (matchedOrder) {
      issue.order = issue.order || matchedOrder._id;
      issue.orderNumber = matchedOrder.orderNumber;
    }
  }

  return issue;
};

const getIssues = async () => {
  const issues = await Issue.find()
    .sort({ createdAt: -1 })
    .populate('order')
    .populate('product')
    .populate('seller')
    .populate('buyer')
    .populate('admin')
    .lean();

  return Promise.all(issues.map(sanitizeAndEnrichIssue));
};

const getIssueById = async (issueId: string) => {
  const issue: any = await Issue.findById(issueId)
    .populate('order')
    .populate('product')
    .populate('seller')
    .populate('buyer')
    .populate('admin')
    .lean();
  if (!issue) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Issue not found');
  }
  return sanitizeAndEnrichIssue(issue);
};

export const IssueService = {
  createIssue,
  resolveIssue,
  getIssues,
  getIssueById,
};
