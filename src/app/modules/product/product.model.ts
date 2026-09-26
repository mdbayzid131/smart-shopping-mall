import { Schema, model } from 'mongoose';
import { IProduct } from './product.interface';

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true },
    images: {
      type: [String],
      required: true,
      validate: {
        validator: (images: string[]) => images.length >= 1 && images.length <= 4,
        message: 'A product must have between 1 and 4 images',
      },
    },
    // Transitional read support for records created before images[] was added.
    image: { type: String },
    brand: { type: String, required: true },
    description: { type: String, required: true },
    material: { type: String },
    price: { type: Number, required: true },
    condition: { type: String, required: true },
    originalPackagingAvailable: { type: Boolean, required: true },
    packaging: { type: String },
    proofOfPurchase: { type: String, default: null },
    status: {
      type: String,
      enum: [
        'pending_review',
        'live',
        'rejected',
        'reserved',
        'collected',
        'authenticated',
        'dispatched',
        'delivered',
        'sold',
        'available',
        'secured',
        'under_review',
      ],
      default: 'pending_review',
    },
    rejectionReason: { type: String, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    commissionAmount: { type: Number, default: 0 },
    sellerEarnings: { type: Number, default: 0 },
    collectionAddress: { type: String },
    sellerPhone: { type: String },
    wishlistCount: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
    },
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    buyer: { type: Schema.Types.ObjectId, ref: 'User' },
    reservationExpiresAt: { type: Date, default: null },
    orderId: { type: Number, required: true, unique: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_document, returned) => {
        if (
          (!returned.images || returned.images.length === 0) &&
          returned.image
        ) {
          returned.images = [returned.image];
        }
        delete returned.image;
        return returned;
      },
    },
  },
);

productSchema.index({ status: 1 });
productSchema.index({ seller: 1 });
productSchema.index({ wishlistCount: -1 });
productSchema.index({ status: 1, reservationExpiresAt: 1 });
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ seller: 1, createdAt: -1 });

export const Product = model<IProduct>('Product', productSchema);
