import { PipelineStage } from 'mongoose';

export const WARDROBE_REVIEW_STATUSES = ['pending_review', 'under_review'];
export const WARDROBE_SOLD_STATUSES = ['sold', 'delivered', 'completed', 'refunded'];
export const ACTIVE_CLOSET_STATUSES = [
  'pending_review', 'under_review', 'live', 'available', 'reserved', 'secured',
  'collected', 'authenticated', 'dispatched',
];

// Products can retain a reserved/collected status after an order is refunded.
// Resolve the same latest confirmed order used by the product-list transformer.
export const wardrobeStatusStages = (): PipelineStage[] => [
  { $lookup: {
    from: 'orders', let: { productId: '$_id' },
    pipeline: [
      { $match: { $expr: { $eq: ['$product', '$$productId'] },
        'payment.status': { $in: ['paid', 'refunded'] },
        status: { $ne: 'pending_payment' } } },
      { $sort: { createdAt: -1, _id: -1 } },
      { $limit: 1 },
      { $project: { status: 1 } },
    ], as: '_wardrobeOrder',
  } },
  // A confirmed order is authoritative even when a legacy product document
  // still says pending/under_review/live. Reposting creates a new listing;
  // keeping the old listing must never make a refunded order active again.
  { $addFields: { _wardrobeStatus: {
    $ifNull: [{ $arrayElemAt: ['$_wardrobeOrder.status', 0] }, '$status'],
  } } },
];

export const wardrobeSortStages = (): PipelineStage[] => [
  ...wardrobeStatusStages(),
  {
    $addFields: {
      _wardrobePriority: {
        $switch: {
          branches: [
            { case: { $in: ['$_wardrobeStatus', WARDROBE_REVIEW_STATUSES] }, then: 0 },
            { case: { $in: ['$_wardrobeStatus', WARDROBE_SOLD_STATUSES] }, then: 2 },
          ],
          default: 1,
        },
      },
    },
  },
  { $sort: { _wardrobePriority: 1, createdAt: -1, _id: -1 } },
];
