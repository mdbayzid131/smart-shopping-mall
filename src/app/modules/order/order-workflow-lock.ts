import { randomUUID } from 'crypto';
import { Order } from './order.model';
import ApiError from '../../../errors/ApiError';

/** Cross-process exclusion before payment/status side effects. Stripe also has
 * a stable per-order idempotency key so an interrupted refund can be retried. */
export const withOrderWorkflowLock = async <T>(id: string, run: () => Promise<T>): Promise<T> => {
  const token = randomUUID();
  const locked = await Order.collection.findOneAndUpdate({
    _id: new Order.base.Types.ObjectId(id),
    $or: [{ 'workflowLease.expiresAt': { $lte: new Date() } }, { workflowLease: { $exists: false } }],
  }, { $set: { workflowLease: { token, expiresAt: new Date(Date.now() + 300_000) } } });
  if (!locked) throw new ApiError(409, 'This order is being updated. Please refresh and try again.');
  try { return await run(); }
  finally {
    await Order.collection.updateOne({ _id: new Order.base.Types.ObjectId(id), 'workflowLease.token': token },
      { $unset: { workflowLease: 1 } });
  }
};
