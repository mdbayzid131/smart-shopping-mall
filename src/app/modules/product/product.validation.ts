import { z } from 'zod';

const createProductZodSchema = z.object({
  name: z.string({ required_error: 'Name is required' }),
  brand: z.string({ required_error: 'Brand is required' }),
  description: z.string({ required_error: 'Description is required' }),
  material: z.string().trim().max(100).optional(),
  price: z.number({ required_error: 'Price is required' }),
  condition: z.string({ required_error: 'Condition is required' }),
  originalPackagingAvailable: z.boolean({
    required_error: 'Original packaging availability is required',
  }),
  packaging: z.string().optional(),
  collectionAddress: z.string().optional(),
  sellerPhone: z.string().optional(),
});

const updateProductZodSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    brand: z.string().optional(),
    description: z.string().optional(),
    material: z.string().trim().max(100).optional(),
    price: z.number().optional(),
    condition: z.string().optional(),
    originalPackagingAvailable: z.boolean().optional(),
    packaging: z.string().optional(),
    collectionAddress: z.string().optional(),
    sellerPhone: z.string().optional(),
    proofOfPurchase: z.string().url().nullable().optional(),
    status: z
      .enum([
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
      ])
      .optional(),
  }),
});

const approveProductZodSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    brand: z.string().optional(),
    description: z.string().optional(),
    price: z.number().optional(),
    condition: z.string().optional(),
    packaging: z.string().optional(),
    material: z.string().optional(),
  }),
});

const rejectProductZodSchema = z.object({
  body: z.object({
    reason: z
      .string({ required_error: 'Rejection reason is required' })
      .min(3, 'Rejection reason must be at least 3 characters'),
  }),
});

export const ProductValidation = {
  createProductZodSchema,
  updateProductZodSchema,
  approveProductZodSchema,
  rejectProductZodSchema,
};
