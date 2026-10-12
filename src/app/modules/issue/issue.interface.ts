import { Types } from 'mongoose';
import { ISSUE_TYPE } from '../../../enums/issue';
import { ORDER_OUTCOME } from '../../../enums/order';

export type IIssue = {
  order?: Types.ObjectId;
  orderNumber?: string;
  product: Types.ObjectId;
  buyer?: Types.ObjectId;
  seller: Types.ObjectId;
  issueType: ISSUE_TYPE;
  outcome: ORDER_OUTCOME;
  reason: string;
  admin: Types.ObjectId;
  resolved: boolean;
}
