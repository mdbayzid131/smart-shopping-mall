import { PipelineStage } from 'mongoose';
import { normalizePagination } from '../../builder/QueryBuilder';
import { ORDER_STATUS, PAYMENT_STATUS } from '../../../enums/order';

/** Checkout attempts remain internal until money has actually been collected. */
export const buildConfirmedOrderFilter = (scope: Record<string, unknown>) => ({
  $and: [
    scope,
    { 'payment.status': { $in: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.REFUNDED] } },
    { status: { $ne: ORDER_STATUS.PENDING_PAYMENT } },
  ],
});

/** Active orders first, completed deliveries next, refunds/cancellations last. */
export const orderHistorySortStages = (
  query: Record<string, unknown>,
): PipelineStage[] => {
  const { page, limit } = normalizePagination(query);
  return [
    {
      $addFields: {
        _historyPriority: {
          $switch: {
            branches: [
              {
                case: {
                  $or: [
                    { $eq: ['$payment.status', PAYMENT_STATUS.REFUNDED] },
                    {
                      $in: [
                        '$status',
                        [ORDER_STATUS.CANCELLED],
                      ],
                    },
                  ],
                },
                then: 2,
              },
              {
                case: {
                  $in: [
                    '$status',
                    [ORDER_STATUS.DELIVERED],
                  ],
                },
                then: 1,
              },
            ],
            default: 0,
          },
        },
      },
    },
    { $sort: { _historyPriority: 1, createdAt: -1, _id: -1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    { $project: { _id: 1 } },
  ];
};
