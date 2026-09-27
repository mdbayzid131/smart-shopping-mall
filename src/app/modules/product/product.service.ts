/* eslint-disable @typescript-eslint/no-explicit-any */
import { StatusCodes } from 'http-status-codes';
import type { Express } from 'express';
import config from '../../../config';
import ApiError from '../../../errors/ApiError';
import QueryBuilder from '../../builder/QueryBuilder';
import { IProduct } from './product.interface';
import { Product } from './product.model';
import { uploadToS3, deleteFromS3 } from '../../../helpers/s3Helper';
import { cache } from '../../../helpers/cache';
import fs from 'fs';
import { ConnectService } from '../payment/connect.service';
import {
  buildProductFeedCacheDiscriminator,
  buildProductFeedViewerFilter,
} from './product-feed.util';
import { User } from '../user/user.model';
import { Wishlist } from '../wishlist/wishlist.model';
import { Order } from '../order/order.model';
import { NotificationEvent } from '../notification/notification.event';
import { errorLogger } from '../../../shared/logger';
import { optimizeUploadedImage } from '../../../helpers/imageOptimizer';
import {
  invalidateProductCaches,
  PRODUCT_DETAIL_CACHE_PREFIX,
  PRODUCT_LIST_CACHE_PREFIX,
  synchronizeProductStatusMutation,
} from './product-state-sync';
import {
  toPublicProduct,
  toProductListItem,
  toAdminProduct,
  toFeedProduct,
} from './product.transformer';

export { PRODUCT_LIST_CACHE_PREFIX } from './product-state-sync';
const PRODUCT_LIST_CACHE_TTL_MS = 60 * 1000;
const PRODUCT_DETAIL_CACHE_TTL_MS = 5 * 60 * 1000;

const createProductToDB = async (
  payload: Partial<IProduct>,
  files: any,
) => {
  const imageFiles = files?.image ?? [];
  if (imageFiles.length < 1 || imageFiles.length > 4) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'A product requires between 1 and 4 images',
    );
  }

  // Generate unique orderId
  const lastProduct = await Product.findOne()
    .sort({ orderId: -1 })
    .select('orderId')
    .lean();
  const nextOrderId = lastProduct ? lastProduct.orderId + 1 : 1000; // Start from 1000 if no products exist
  payload.orderId = nextOrderId;

  // Calculate platform commission and seller earnings
  const feePercentage = config.platform.feePercentage ?? 12;
  const price = Number(payload.price);
  payload.commissionAmount = Number(((price * feePercentage) / 100).toFixed(2));
  payload.sellerEarnings = Number((price - payload.commissionAmount).toFixed(2));
  payload.status = 'pending_review';

  let imageUrls: string[] = [];
  let proofUrl: string | undefined;
  const documentFiles = files?.doc ?? [];
  try {
    const optimizedImageFiles = await Promise.all(
      imageFiles.map((imageFile: Express.Multer.File) =>
        optimizeUploadedImage(imageFile),
      ),
    );
    const uploadTasks = [
      ...optimizedImageFiles.map((imageFile: Express.Multer.File) =>
        uploadToS3(imageFile, 'product-images/optimized'),
      ),
      ...(documentFiles[0]
        ? [uploadToS3(documentFiles[0], 'product-proofs')]
        : []),
    ];
    const uploadResults = await Promise.allSettled(uploadTasks);
    const uploadedUrls = uploadResults
      .filter(
        (result): result is PromiseFulfilledResult<string> =>
          result.status === 'fulfilled',
      )
      .map(result => result.value);
    const failedUpload = uploadResults.find(
      result => result.status === 'rejected',
    ) as PromiseRejectedResult | undefined;

    if (failedUpload) {
      await Promise.all(
        uploadedUrls.map(url => deleteFromS3(url).catch(() => undefined)),
      );
      throw failedUpload.reason;
    }

    imageUrls = uploadedUrls.slice(0, imageFiles.length);
    proofUrl = documentFiles[0] ? uploadedUrls[imageFiles.length] : undefined;
  } finally {
    await Promise.all(
      [...imageFiles, ...documentFiles].map((file: any) =>
        fs.promises.unlink(file.path).catch(() => undefined),
      ),
    );
  }

  payload.images = imageUrls;
  delete payload.image;

  if (proofUrl) {
    payload.proofOfPurchase = proofUrl;
  }

  // Auto-sync seller profile info (phone, location, country, sellerName) in DB
  if (payload.seller) {
    const sellerUpdate: Record<string, any> = {};
    const sellerPhone = (payload as any).sellerPhone;
    const sellerLocation = (payload as any).sellerLocation;
    const sellerCountry = (payload as any).sellerCountry;
    const sellerName = (payload as any).sellerName;

    if (sellerPhone && typeof sellerPhone === 'string' && sellerPhone.trim().length > 0) {
      sellerUpdate.phone = sellerPhone.trim();
      sellerUpdate.contact = sellerPhone.trim();
      payload.sellerPhone = sellerPhone.trim();
    }
    if (sellerLocation && typeof sellerLocation === 'string' && sellerLocation.trim().length > 0) {
      sellerUpdate.location = sellerLocation.trim();
      payload.collectionAddress = sellerLocation.trim();
    }
    if (sellerCountry && typeof sellerCountry === 'string' && sellerCountry.trim().length > 0) {
      sellerUpdate.country = sellerCountry.trim();
    }
    if (sellerName && typeof sellerName === 'string' && sellerName.trim().length > 0) {
      sellerUpdate.name = sellerName.trim();
    }
    if (Object.keys(sellerUpdate).length > 0) {
      await User.findByIdAndUpdate(payload.seller, { $set: sellerUpdate }).catch(() => undefined);
    }

    delete (payload as any).sellerPhone;
    delete (payload as any).sellerLocation;
    delete (payload as any).sellerCountry;
    delete (payload as any).sellerName;
  }

  const created = await Product.create(payload);
  const result = await Product.findById(created._id)
    .populate('seller', 'name image avatar contact phone location country')
    .lean();
  invalidateProductCaches(created._id.toString());
  void NotificationEvent.itemListed(
    created.seller.toString(),
    created._id.toString(),
  );
  return toPublicProduct(result);
};



const getAllProductsFromDB = async (
  query: Record<string, unknown>,
  viewerId?: string,
) => {
  const queryWithDefaults: Record<string, unknown> = { ...query };

  // If viewing a specific seller's profile - Only show live/available products
  if (queryWithDefaults.seller) {
    if (!queryWithDefaults.status) {
      queryWithDefaults.status = { $in: ['live', 'available'] };
    }
  } else {
    // General feed - Only show items that are live or available for sale to general buyers.
    if (
      !queryWithDefaults.status ||
      queryWithDefaults.status === 'available' ||
      queryWithDefaults.status === 'live'
    ) {
      queryWithDefaults.status = { $in: ['live', 'available'] };
    } else if (Array.isArray(queryWithDefaults.status)) {
      const statusSet = new Set(queryWithDefaults.status as string[]);
      if (statusSet.has('available') || statusSet.has('live')) {
        statusSet.add('available');
        statusSet.add('live');
        queryWithDefaults.status = { $in: Array.from(statusSet) };
      }
    }
  }

  type ProductListResponse = {
    result: IProduct[];
    meta: { total: number; limit: number; page: number; totalPage: number };
  };

  const cacheKey =
    PRODUCT_LIST_CACHE_PREFIX +
    buildProductFeedCacheDiscriminator(queryWithDefaults, viewerId);
  return cache.getOrSet<ProductListResponse>(
    cacheKey,
    PRODUCT_LIST_CACHE_TTL_MS,
    async () => {
      // Keep the exclusion in a separate $and clause so a caller-provided
      // seller filter cannot overwrite it through QueryBuilder.filter().
      // Do not exclude when explicitly viewing that seller's products.
      const viewerFilter = queryWithDefaults.seller
        ? {}
        : buildProductFeedViewerFilter(viewerId);
      const productQuery = new QueryBuilder(
        Product.find(viewerFilter),
        queryWithDefaults,
      )
        .search(['name', 'brand', 'description'])
        .filter()
        .sort()
        .paginate()
        .fields();

      const [result, meta] = await Promise.all([
        productQuery.modelQuery
          .populate('seller', 'name image avatar contact phone location country')
          .lean(),
        productQuery.getPaginationInfo(),
      ]);

      if (queryWithDefaults.seller) {
        const productIds = result.map((p: any) => p._id);
        const activeOrders = await Order.find({
          product: { $in: productIds },
          status: { $nin: ['cancelled', 'refunded'] },
        }).select('product status').lean();

        const orderStatusByProductId = new Map<string, string>();
        for (const ord of activeOrders) {
          orderStatusByProductId.set(ord.product.toString(), ord.status);
        }

        const mappedResult = result.map((p: any) => {
          const matchingOrderStatus = orderStatusByProductId.get(p._id?.toString());
          return toProductListItem(p, matchingOrderStatus);
        });

        return { result: mappedResult, meta };
      }

      // Public Home Newsfeed
      return { result: result.map(toFeedProduct), meta };
    },
  );
};

const getPendingReviewProductsFromDB = async (query: Record<string, unknown>) => {
  const filterQuery = { status: 'pending_review', ...query };
  const productQuery = new QueryBuilder(Product.find(), filterQuery)
    .search(['name', 'brand', 'description'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [result, meta] = await Promise.all([
    productQuery.modelQuery
      .populate('seller', 'name email image avatar contact phone location country stripeAccountId')
      .lean(),
    productQuery.getPaginationInfo(),
  ]);

  return { result: result.map(toAdminProduct), meta };
};

const approveProductInDB = async (
  id: string,
  adminId: string,
  updateData?: Partial<IProduct>,
) => {
  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Product not found');
  }
  if (product.status !== 'pending_review') {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Product status is currently '${product.status}', only 'pending_review' items can be approved`,
    );
  }

  const payload: Partial<IProduct> = {
    ...updateData,
    status: 'live',
    reviewedAt: new Date(),
  };

  if (updateData?.price) {
    const feePercentage = config.platform.feePercentage ?? 12;
    const price = Number(updateData.price);
    payload.commissionAmount = Number(((price * feePercentage) / 100).toFixed(2));
    payload.sellerEarnings = Number((price - payload.commissionAmount).toFixed(2));
  }

  const mutation = Product.findByIdAndUpdate(id, payload, { new: true });
  const result = await synchronizeProductStatusMutation(mutation, {
    productId: id,
    status: 'live',
  });

  if (result) {
    void NotificationEvent.itemApproved(
      result.seller.toString(),
      result._id.toString(),
    );
  }
  return result;
};

const rejectProductInDB = async (
  id: string,
  adminId: string,
  rejectionReason: string,
) => {
  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Product not found');
  }

  const mutation = Product.findByIdAndUpdate(
    id,
    {
      status: 'rejected',
      rejectionReason: rejectionReason.trim(),
      reviewedAt: new Date(),
    },
    { new: true },
  );
  const result = await synchronizeProductStatusMutation(mutation, {
    productId: id,
    status: 'rejected',
  });

  if (result) {
    void NotificationEvent.itemRejected(
      result.seller.toString(),
      result._id.toString(),
      rejectionReason.trim(),
    );
  }
  return result;
};

const getMyProductsFromDB = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const productQuery = new QueryBuilder(Product.find({ seller: userId }), query)
    .filter()
    .sort()
    .paginate()
    .fields();

  const [result, meta] = await Promise.all([
    productQuery.modelQuery.lean(),
    productQuery.getPaginationInfo(),
  ]);

  const productIds = result.map((p: any) => p._id);
  const latestOrders = await Order.find({
    product: { $in: productIds },
  })
    .sort({ createdAt: -1 })
    .select('product status cancellationReason outcome note')
    .lean();

  const orderStatusByProductId = new Map<string, string>();
  for (const ord of latestOrders) {
    const pId = ord.product.toString();
    if (!orderStatusByProductId.has(pId)) {
      orderStatusByProductId.set(pId, ord.status);
    }
  }

  const mappedResult = result.map((p: any) => {
    const matchingOrderStatus = orderStatusByProductId.get(p._id?.toString());
    return toProductListItem(p, matchingOrderStatus);
  });

  return { result: mappedResult, meta };
};

const getAllProductsForAdmin = async (query: Record<string, unknown>) => {
  const productQuery = new QueryBuilder(Product.find(), query)
    .search(['name', 'brand', 'description'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [result, meta] = await Promise.all([
    productQuery.modelQuery
      .populate('seller', 'name email image avatar contact phone location country stripeAccountId')
      .populate('buyer', 'name email image avatar contact phone location country address')
      .lean(),
    productQuery.getPaginationInfo(),
  ]);

  return { result: result.map(toAdminProduct), meta };
};

const getProductDetailsFromDB = async (id: string) => {
  const cacheKey = `${PRODUCT_DETAIL_CACHE_PREFIX}${id}`;
  return cache.getOrSet(cacheKey, PRODUCT_DETAIL_CACHE_TTL_MS, async () => {
    const result = await Product.findById(id)
      .populate('seller', 'name image avatar contact phone location country')
      .populate('buyer', 'name image avatar contact phone location country address')
      .lean();
    if (!result) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Product not found');
    }

    const latestOrder = await Order.findOne({
      product: id,
    })
      .sort({ createdAt: -1 })
      .populate('buyer', 'name image avatar contact phone location country address')
      .lean();

    return toPublicProduct(result, latestOrder);
  });
};

const updateProductToDB = async (
  id: string,
  userId: string,
  userRole: string,
  payload: Partial<IProduct>,
  files?: any,
) => {
  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Product not found');
  }

  // Only seller or admin can update
  if (
    userRole !== 'ADMIN' &&
    userRole !== 'SUPER_ADMIN' &&
    product.seller.toString() !== userId
  ) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'You do not have permission to update this product',
    );
  }

  // Handle uploaded proofOfPurchase document/image if present
  const documentFiles = files?.doc ?? [];
  if (documentFiles.length > 0) {
    try {
      const uploadResult = await uploadToS3(documentFiles[0], 'product-proofs');
      payload.proofOfPurchase = uploadResult;
    } finally {
      await Promise.all(
        documentFiles.map((file: any) =>
          fs.promises.unlink(file.path).catch(() => undefined),
        ),
      );
    }
  }

  // If price is updated, recalculate commission and seller earnings
  if (payload.price !== undefined && payload.price !== null) {
    const feePercentage = config.platform.feePercentage ?? 12;
    const price = Number(payload.price);
    payload.commissionAmount = Number(((price * feePercentage) / 100).toFixed(2));
    payload.sellerEarnings = Number((price - payload.commissionAmount).toFixed(2));
  }

  const wasRejected = product.status === 'rejected';
  // If product was rejected and is being updated by seller, reset to pending_review
  if (wasRejected && userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
    payload.status = 'pending_review';
    payload.rejectionReason = '';
  }

  const mutation = Product.findByIdAndUpdate(id, payload, { new: true });
  const result = payload.status
    ? await synchronizeProductStatusMutation(mutation, {
        productId: id,
        status: payload.status,
      })
    : await mutation;
  if (!payload.status) invalidateProductCaches(id);
  if (result) {
    if (wasRejected || payload.status === 'pending_review') {
      void NotificationEvent.itemListed(
        result.seller.toString(),
        result._id.toString(),
      );
    }

    void Wishlist.distinct('user', { product: result._id })
      .then(watcherIds =>
        Promise.all(
          watcherIds.map(watcherId =>
            NotificationEvent.wishlistItemUpdated(
              watcherId.toString(),
              result._id.toString(),
              result.name,
              (result.get('updatedAt') as Date).getTime().toString(),
            ),
          ),
        ),
      )
      .catch(error => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errorLogger.error(`[NOTIFICATION] Wishlist update failed: ${message}`);
      });
  }
  return result;
};

const deleteProductFromDB = async (
  id: string,
  userId: string,
  userRole: string,
) => {
  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Product not found');
  }

  // Only seller or admin can delete
  if (
    userRole !== 'ADMIN' &&
    userRole !== 'SUPER_ADMIN' &&
    product.seller.toString() !== userId
  ) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'You do not have permission to delete this product',
    );
  }

  // Delete images from S3
  const deletePromises = [];
  const productImages = product.images?.length
    ? product.images
    : product.image
      ? [product.image]
      : [];
  deletePromises.push(...productImages.map(image => deleteFromS3(image)));
  if (product.proofOfPurchase) {
    deletePromises.push(deleteFromS3(product.proofOfPurchase));
  }
  const watcherIds = await Wishlist.distinct('user', { product: product._id });
  await Promise.all(deletePromises);

  const result = await Product.findByIdAndDelete(id);
  await Wishlist.deleteMany({ product: product._id });
  invalidateProductCaches(id);
  if (result) {
    void Promise.all(
      watcherIds.map(watcherId =>
        NotificationEvent.wishlistItemUnavailable(
          watcherId.toString(),
          result._id.toString(),
          result.name,
        ),
      ),
    );
  }
  return result;
};

export const ProductService = {
  createProductToDB,
  getAllProductsFromDB,
  getPendingReviewProductsFromDB,
  approveProductInDB,
  rejectProductInDB,
  getMyProductsFromDB,
  getAllProductsForAdmin,
  getProductDetailsFromDB,
  updateProductToDB,
  deleteProductFromDB,
};
