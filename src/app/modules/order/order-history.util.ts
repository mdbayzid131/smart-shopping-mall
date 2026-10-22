import { ORDER_STATUS, PAYMENT_STATUS } from '../../../enums/order';

/** Checkout attempts remain internal until money has actually been collected. */
export const buildConfirmedOrderFilter = (scope: Record<string, unknown>) => ({
  $and: [
    scope,
    { 'payment.status': { $in: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.REFUNDED] } },
    { status: { $ne: ORDER_STATUS.PENDING_PAYMENT } },
  ],
});
