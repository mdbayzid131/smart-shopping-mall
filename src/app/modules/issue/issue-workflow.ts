import { ORDER_OUTCOME as O, ORDER_STATUS as S } from '../../../enums/order';
import ApiError from '../../../errors/ApiError';

export const isOperationalOutcome = (outcome: O) =>
  [O.SELLER_UNAVAILABLE, O.BUYER_UNAVAILABLE, O.CONDITION_DIFFERS].includes(outcome);

export const assertIssueStage = (status: S, outcome: O) => {
  const stages: Partial<Record<O, S[]>> = {
    [O.SELLER_UNAVAILABLE]: [S.RESERVED, S.COLLECTION_PENDING],
    [O.BUYER_UNAVAILABLE]: [S.DISPATCHED],
    [O.CONDITION_DIFFERS]: [S.COLLECTED],
    [O.AUTHENTICATION_FAILED]: [S.COLLECTED],
    [O.COUNTERFEIT]: [S.COLLECTED],
    [O.BUYER_CHANGED_MIND]: [S.DISPATCHED],
    [O.BUYER_CANCELLED]: [S.RESERVED, S.COLLECTION_PENDING, S.COLLECTED, S.VERIFICATION, S.READY_FOR_DELIVERY, S.PAYOUT_PROCESSING],
    [O.SELLER_CANCELLED]: [S.RESERVED, S.COLLECTION_PENDING, S.COLLECTED, S.VERIFICATION, S.READY_FOR_DELIVERY, S.PAYOUT_PROCESSING],
  };
  if (!stages[outcome]?.includes(status)) throw new ApiError(400, 'This issue reason is not available at the current order stage.');
};

export const issueActions = (outcome: O, status: S, resolved: boolean): string[] => {
  if (resolved || [S.REFUNDED, S.CANCELLED, S.DELIVERED, S.COMPLETED].includes(status)) return [];
  if (outcome === O.SELLER_UNAVAILABLE && [S.RESERVED, S.COLLECTION_PENDING].includes(status)) return ['retry_collection'];
  if (outcome === O.BUYER_UNAVAILABLE && status === S.DISPATCHED) return ['retry_delivery'];
  if (outcome === O.CONDITION_DIFFERS && status === S.COLLECTED) return ['cancel_order', 'dispatch'];
  return [];
};
