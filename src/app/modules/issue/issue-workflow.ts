import { ORDER_OUTCOME as O, ORDER_STATUS as S } from '../../../enums/order';
import ApiError from '../../../errors/ApiError';

export const isOperationalOutcome = (outcome: O) =>
  [O.SELLER_UNAVAILABLE, O.BUYER_UNAVAILABLE].includes(outcome);

export const assertIssueStage = (status: S, outcome: O) => {
  const stages: Partial<Record<O, S[]>> = {
    [O.SELLER_UNAVAILABLE]: [S.RESERVED],
    [O.BUYER_UNAVAILABLE]: [S.DISPATCHED],
    [O.CONDITION_DIFFERS]: [S.COLLECTED],
    [O.AUTHENTICATION_FAILED]: [S.COLLECTED],
    [O.COUNTERFEIT]: [S.COLLECTED],
    [O.BUYER_CHANGED_MIND]: [S.DISPATCHED],
    [O.BUYER_CANCELLED]: [S.RESERVED, S.COLLECTED, S.VERIFICATION],
    [O.SELLER_CANCELLED]: [S.RESERVED, S.COLLECTED, S.VERIFICATION],
  };
  if (!stages[outcome]?.includes(status)) throw new ApiError(400, 'This issue reason is not available at the current order stage.');
};

export const issueActions = (outcome: O, status: S, resolved: boolean): string[] => {
  if (resolved || [S.CANCELLED, S.DELIVERED].includes(status)) return [];
  if (outcome === O.SELLER_UNAVAILABLE && status === S.RESERVED) return ['retry_collection'];
  if (outcome === O.BUYER_UNAVAILABLE && status === S.DISPATCHED) return ['retry_delivery'];
  return [];
};
