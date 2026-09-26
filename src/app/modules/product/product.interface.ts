/* eslint-disable @typescript-eslint/consistent-type-definitions */
import { Types } from 'mongoose';

export type IProductStatus =
  | 'pending_review'
  | 'live'
  | 'rejected'
  | 'reserved'
  | 'collected'
  | 'authenticated'
  | 'dispatched'
  | 'delivered'
  | 'sold'
  | 'available'
  | 'secured'
  | 'under_review';

export interface IProduct {
  name: string;
  images: string[];
  /** @deprecated Read-only compatibility for products created before images[]. */
  image?: string;
  brand: string;
  description: string;
  material?: string;
  price: number;
  condition: string;
  originalPackagingAvailable: boolean;
  packaging?: string;
  proofOfPurchase?: string | null;
  status: IProductStatus;
  rejectionReason?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  commissionAmount?: number;
  sellerEarnings?: number;
  collectionAddress?: string;
  sellerPhone?: string;
  wishlistCount: number;
  seller: Types.ObjectId;
  orderId: number;
  buyer?: Types.ObjectId;
  reservationExpiresAt?: Date;
}
