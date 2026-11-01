import config from '../../../config';
import { ORDER_OUTCOME } from '../../../enums/order';
import { User } from './user.model';

type PenaltyResult = { count: number; status: 'active' | 'restricted' | 'suspended' | 'ban' };
const recordSellerOffence = async (sellerId: string, outcome: ORDER_OUTCOME, orderId?: string): Promise<PenaltyResult | null> => {
  if (![ORDER_OUTCOME.AUTHENTICATION_FAILED, ORDER_OUTCOME.COUNTERFEIT].includes(outcome) || !orderId) return null;
  let user = await User.findOneAndUpdate(
    { _id: sellerId, authenticationFailureOrders: { $ne: orderId } },
    { $inc: { failedAuthentications: 1 }, $addToSet: { authenticationFailureOrders: orderId } },
    { new: true },
  );
  if (!user) user = await User.findById(sellerId).select('failedAuthentications status');
  if (!user) return null;
  if (user.failedAuthentications >= config.penaltyPolicy.sellerStrikeSuspensionThreshold) {
    await User.updateOne({ _id: sellerId, status: { $in: ['active', 'restricted'] } }, {
      $set: { status: 'suspended', statusReason: 'Account suspended after repeated failed item authentications. Contact Closete Support to request a review.' },
    });
    if (user.status === 'active' || user.status === 'restricted') user.status = 'suspended';
  }
  return { count: user.failedAuthentications, status: user.status };
};
const recordMissedCollection = async (sellerId: string): Promise<PenaltyResult | null> => {
  const user = await User.findByIdAndUpdate(sellerId, { $inc: { missedCollections: 1 } }, { new: true });
  return user ? { count: user.missedCollections, status: user.status } : null;
};
// Kept for compatibility; operational availability and customer cancellation
// must not restrict an account. No new buyer penalty is introduced by this flow.
const recordUnjustifiedBuyerRejection = async (_buyerId: string): Promise<PenaltyResult | null> => null;
export const UserPenaltyService = { recordSellerOffence, recordMissedCollection, recordUnjustifiedBuyerRejection };
