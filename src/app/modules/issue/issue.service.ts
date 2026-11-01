import { Types } from 'mongoose';
import ApiError from '../../../errors/ApiError';
import { Issue } from './issue.model';
import { Order } from '../order/order.model';
import { ORDER_OUTCOME, ORDER_STATUS, PAYMENT_STATUS } from '../../../enums/order';
import { ISSUE_TYPE } from '../../../enums/issue';
import { OrderService } from '../order/order.service';
import { withOrderWorkflowLock } from '../order/order-workflow-lock';
import { assertIssueStage, isOperationalOutcome, issueActions } from './issue-workflow';
import { NotificationEvent } from '../notification/notification.event';
import { buildConfirmedOrderFilter } from '../order/order-history.util';

type Resolution = 'retry_collection' | 'retry_delivery' | 'cancel_order' | 'dispatch';
const idOf = (value: any) => String(value?._id ?? value);

const createIssue = async (
  productId: string | undefined, orderId: string | undefined, issueType: ISSUE_TYPE,
  outcome: ORDER_OUTCOME, reason: string | undefined, adminId: string,
) => {
  if (!orderId && !productId) throw new ApiError(400, 'An order or product ID is required.');
  const target = orderId ? await Order.findById(orderId) :
    await Order.findOne(buildConfirmedOrderFilter({ product: productId })).sort({ createdAt: -1 });
  if (!target) throw new ApiError(404, 'A confirmed order is required to report an issue.');
  if (productId && idOf(target.product) !== productId) throw new ApiError(400, 'Product does not match this order.');
  return withOrderWorkflowLock(idOf(target._id), async () => {
    let order = await Order.findById(target._id);
    if (!order) throw new ApiError(404, 'Order not found');
    const existing = await Issue.findOne({ order: order._id, resolved: false });
    if (existing && existing.outcome !== outcome) throw new ApiError(409, 'Resolve the existing issue first.');
    if (existing && order.status === ORDER_STATUS.REFUNDED && order.payment.status === PAYMENT_STATUS.REFUNDED && order.outcome === outcome) {
      if ([ORDER_OUTCOME.AUTHENTICATION_FAILED, ORDER_OUTCOME.COUNTERFEIT].includes(outcome)) {
        const { UserPenaltyService } = await import('../user/user-penalty.service');
        await UserPenaltyService.recordSellerOffence(idOf(order.seller), outcome, idOf(order._id));
        await NotificationEvent.authenticationFailed(order, outcome as ORDER_OUTCOME.AUTHENTICATION_FAILED | ORDER_OUTCOME.COUNTERFEIT);
      }
      existing.resolved = true;
      existing.resolvedAt = new Date();
      existing.resolutionAction = 'refunded';
      await existing.save();
      await Order.updateOne({ _id: order._id, activeIssue: existing._id }, { $unset: { activeIssue: 1 } });
      return existing;
    }
    assertIssueStage(order.status, outcome);
    if (order.payment.status !== PAYMENT_STATUS.PAID) throw new ApiError(400, 'Only paid orders can enter this workflow.');
    const effectiveReason = reason?.trim() || outcome.replace(/_/g, ' ');
    const issue = existing ?? await Issue.create({
      order: order._id, orderNumber: order.orderNumber, product: order.product,
      buyer: order.buyer, seller: order.seller, issueType, outcome,
      reason: effectiveReason, admin: adminId, resolved: false,
    });
    if (!existing) {
      order.activeIssue = issue._id;
      await order.save();
    }
    if (isOperationalOutcome(outcome)) {
      order.activeIssue = issue._id;
      if (outcome === ORDER_OUTCOME.CONDITION_DIFFERS) order.conditionNote = effectiveReason;
      if (!existing) {
        order.statusHistory.push({ status: order.status, note: `Issue reported: ${effectiveReason}`,
          changedAt: new Date(), changedBy: new Types.ObjectId(adminId) });
      }
      await order.save();
      return issue;
    }
    order = await OrderService.updateOrderStatusWithinWorkflow(
      idOf(order._id), ORDER_STATUS.REFUNDED, effectiveReason, adminId, outcome, false,
    );
    issue.resolved = true;
    issue.resolvedAt = new Date();
    issue.resolvedBy = new Types.ObjectId(adminId);
    issue.resolutionAction = 'refunded';
    await issue.save();
    await Order.updateOne({ _id: order._id, activeIssue: issue._id }, { $unset: { activeIssue: 1 } });
    return issue;
  });
};

const resolveIssue = async (issueId: string, action: Resolution, adminId: string) => {
  const target = await Issue.findById(issueId);
  if (!target?.order) throw new ApiError(400, 'This historical issue has no linked order. Manual review is required.');
  return withOrderWorkflowLock(idOf(target.order), async () => {
    const issue = await Issue.findById(issueId);
    if (!issue) throw new ApiError(404, 'Issue not found');
    const order = await Order.findById(issue.order);
    if (!order) throw new ApiError(404, 'Order not found');
    // Safe replay after a lost HTTP response: no repeated payment or notification.
    if (issue.resolved && issue.resolutionAction === action) {
      if (action === 'retry_delivery') await NotificationEvent.deliveryReattempted(order, issueId);
      return issue;
    }
    const completedStep = !issue.resolved && issue.outcome === ORDER_OUTCOME.CONDITION_DIFFERS &&
      ((action === 'dispatch' && order.status === ORDER_STATUS.DISPATCHED) ||
      (action === 'cancel_order' && order.status === ORDER_STATUS.REFUNDED && order.outcome === ORDER_OUTCOME.CONDITION_DIFFERS));
    if (!completedStep && !issueActions(issue.outcome, order.status, issue.resolved).includes(action)) {
      throw new ApiError(400, 'This action is not available for this issue/order. Refunded orders cannot be retried.');
    }
    if (!completedStep && order.payment.status !== PAYMENT_STATUS.PAID) throw new ApiError(400, 'The original payment must remain paid for this action.');
    if (!completedStep && (action === 'cancel_order' || action === 'dispatch')) {
      await OrderService.updateOrderStatusWithinWorkflow(idOf(order._id),
        action === 'cancel_order' ? ORDER_STATUS.REFUNDED : ORDER_STATUS.DISPATCHED,
        issue.reason, adminId, action === 'cancel_order' ? ORDER_OUTCOME.CONDITION_DIFFERS : undefined, false);
      issue.retainNote = action === 'dispatch';
    } else if (!completedStep) {
      // Only queue membership changes, not the order's lifecycle or payment.
      order.statusHistory.push({ status: order.status, note: action === 'retry_collection' ? 'Collection re-attempt arranged' : 'Delivery re-attempt arranged',
        changedAt: new Date(), changedBy: new Types.ObjectId(adminId) });
      await order.save();
    }
    issue.resolved = true;
    issue.resolvedAt = new Date();
    issue.resolvedBy = new Types.ObjectId(adminId);
    issue.resolutionAction = action;
    await issue.save();
    await Order.updateOne({ _id: order._id, activeIssue: issue._id }, { $unset: { activeIssue: 1 } });
    if (action === 'retry_delivery') await NotificationEvent.deliveryReattempted(order, issueId);
    // No generic customer Issue resolved notification and no automatic relisting.
    return issue;
  });
};

const enrich = (issue: any) => ({
  ...issue, allowedActions: issueActions(issue.outcome, issue.order?.status, issue.resolved),
});
const getIssues = async () => {
  const issues = await Issue.find().sort({ createdAt: -1 }).populate('order').populate('product')
    .populate('seller', 'name email phone contact location').populate('buyer', 'name email phone contact location')
    .populate('admin', 'name').lean();
  return issues.map(enrich);
};
const getIssueById = async (id: string) => {
  const issue = await Issue.findById(id).populate('order').populate('product')
    .populate('seller', 'name email phone contact location').populate('buyer', 'name email phone contact location').lean();
  if (!issue) throw new ApiError(404, 'Issue not found');
  return enrich(issue);
};
export const IssueService = { createIssue, resolveIssue, getIssues, getIssueById };
