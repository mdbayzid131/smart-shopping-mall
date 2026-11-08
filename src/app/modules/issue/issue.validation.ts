import { z } from 'zod';
import { ISSUE_TYPE } from '../../../enums/issue';
import { ORDER_OUTCOME } from '../../../enums/order';

const createIssueZodSchema = z.object({
  body: z
    .object({
      productId: z.string().optional(),
      orderId: z.string().optional(),
      issueType: z.nativeEnum(ISSUE_TYPE, {
        required_error: 'Issue type is required',
      }),
      outcome: z.nativeEnum(ORDER_OUTCOME, {
        required_error: 'Outcome is required',
      }),
      reason: z.string().trim().min(1).max(1000).optional(),
    })

    .superRefine((value, context) => {
      if (!value.orderId && !value.productId) context.addIssue({ code: z.ZodIssueCode.custom,
        path: ['orderId'], message: 'An order or product ID is required' });
      const validOutcomes: Record<ISSUE_TYPE, ORDER_OUTCOME[]> = {
        [ISSUE_TYPE.VERIFICATION_FAILED]: [
          ORDER_OUTCOME.AUTHENTICATION_FAILED,
          ORDER_OUTCOME.COUNTERFEIT,
        ],
        [ISSUE_TYPE.SELLER_UNAVAILABLE]: [
          ORDER_OUTCOME.SELLER_UNAVAILABLE,
        ],
        [ISSUE_TYPE.BUYER_REFUSED]: [
          ORDER_OUTCOME.BUYER_CHANGED_MIND,
          ORDER_OUTCOME.NOT_AS_DESCRIBED,
          ORDER_OUTCOME.CONDITION_DIFFERS,
          ORDER_OUTCOME.OTHERS,
        ],
        [ISSUE_TYPE.OTHERS]: [ORDER_OUTCOME.OTHERS],
        [ISSUE_TYPE.BUYER_UNAVAILABLE]: [ORDER_OUTCOME.BUYER_UNAVAILABLE],
        [ISSUE_TYPE.CONDITION_DIFFERS]: [ORDER_OUTCOME.CONDITION_DIFFERS],
        [ISSUE_TYPE.CANCELLATION]: [ORDER_OUTCOME.BUYER_CANCELLED, ORDER_OUTCOME.SELLER_CANCELLED],
      };
      if (!validOutcomes[value.issueType].includes(value.outcome)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['outcome'],
          message: `Outcome is not valid for ${value.issueType}`,
        });
      }
      if (value.issueType === ISSUE_TYPE.OTHERS && !value.reason) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reason'],
          message: 'Reason is required for the top-level others option',
        });
      }
    }),
});

const resolveIssueZodSchema = z.object({
  body: z.object({
    action: z.enum(['retry_collection', 'retry_delivery', 'cancel_order', 'dispatch'], { required_error: 'Action is required' }),
  }),
});

export const IssueValidation = {
  createIssueZodSchema,
  resolveIssueZodSchema,
};
