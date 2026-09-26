import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { Product } from '../product/product.model';
import { Wishlist } from './wishlist.model';
import { NotificationEvent } from '../notification/notification.event';
import { publishProductWishlistCount } from '../product/product-state-sync';

type WishlistMutationResult = {
  wishlist: InstanceType<typeof Wishlist>;
  wishlistCount: number;
};

const addToWishlist = async (
  userId: string,
  productId: string,
): Promise<WishlistMutationResult> => {
  const product = await Product.findById(productId).select('name wishlistCount');
  if (!product) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Product not found');
  }

  const existing = await Wishlist.findOne({
    user: userId,
    product: productId,
  });

  let wishlist: InstanceType<typeof Wishlist>;
  let changed = false;
  if (existing) {
    wishlist = existing;
  } else {
    wishlist = await Wishlist.create({ user: userId, product: productId });
    changed = true;
  }

  const wishlistCount = await Wishlist.countDocuments({
    product: productId,
  });

  const countChanged = product.wishlistCount !== wishlistCount;
  if (countChanged) {
    await Product.updateOne(
      { _id: productId },
      { $set: { wishlistCount } },
    );
  }

  if (changed || countChanged) {
    publishProductWishlistCount(productId, wishlistCount);
  }
  if (changed) {
    void NotificationEvent.wishlistItemSaved(
      userId,
      wishlist._id.toString(),
      productId,
      product.name,
    );
  }

  return {
    wishlist,
    wishlistCount,
  };
};

const removeFromWishlist = async (
  userId: string,
  productId: string,
): Promise<WishlistMutationResult> => {
  const product = await Product.findById(productId).select('_id');
  if (!product) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Product not found');
  }

  const wishlist = await Wishlist.findOneAndDelete({
    user: userId,
    product: productId,
  });
  if (!wishlist) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Item not found in wishlist');
  }

  const wishlistCount = await Wishlist.countDocuments({
    product: productId,
  });

  await Product.updateOne(
    { _id: productId },
    { $set: { wishlistCount } },
  );

  publishProductWishlistCount(productId, wishlistCount);

  return { wishlist, wishlistCount };
};

const getMyWishlist = async (userId: string) => {
  const result = await Wishlist.find({ user: userId })
    .populate({
      path: 'product',
      select: '_id name brand price images image',
    })
    .sort('-createdAt')
    .lean();

  return result
    .filter((w: any) => w.product)
    .map((w: any) => {
      const p = w.product;
      const images = (p.images && p.images.length > 0)
        ? p.images
        : (p.image ? [p.image] : []);

      return {
        _id: w._id?.toString(),
        createdAt: w.createdAt,
        product: {
          _id: p._id?.toString(),
          name: p.name,
          brand: p.brand,
          price: p.price,
          images,
        },
      };
    });
};

export const WishlistService = {
  addToWishlist,
  removeFromWishlist,
  getMyWishlist,
};
