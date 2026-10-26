import { PipelineStage } from 'mongoose';

export const WARDROBE_REVIEW_STATUSES = ['pending_review', 'under_review'];
export const WARDROBE_SOLD_STATUSES = ['sold', 'delivered', 'completed'];

export const wardrobeSortStages = (): PipelineStage[] => [
  {
    $addFields: {
      _wardrobePriority: {
        $switch: {
          branches: [
            { case: { $in: ['$status', WARDROBE_REVIEW_STATUSES] }, then: 0 },
            { case: { $in: ['$status', WARDROBE_SOLD_STATUSES] }, then: 2 },
          ],
          default: 1,
        },
      },
    },
  },
  { $sort: { _wardrobePriority: 1, createdAt: -1, _id: -1 } },
];
