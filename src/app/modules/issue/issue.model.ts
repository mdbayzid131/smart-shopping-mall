import { Schema, model } from 'mongoose';
import { IIssue } from './issue.interface';
import { ISSUE_TYPE } from '../../../enums/issue';
import { ORDER_OUTCOME } from '../../../enums/order';

const issueSchema = new Schema<IIssue>(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    orderNumber: { type: String },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    buyer: { type: Schema.Types.ObjectId, ref: 'User' },
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    issueType: {
      type: String,
      enum: Object.values(ISSUE_TYPE),
      required: true,
    },
    outcome: {
      type: String,
      enum: Object.values(ORDER_OUTCOME),
      required: true,
    },
    reason: { type: String, required: true },
    admin: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    resolved: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_document, returned: any) => {
        delete returned.orderId;
        if (returned.product && typeof returned.product === 'object') {
          delete returned.product.orderId;
        }
        return returned;
      },
    },
  },
);

issueSchema.index({ product: 1, resolved: 1 });
issueSchema.index({ product: 1, createdAt: -1 });

export const Issue = model<IIssue>('Issue', issueSchema);
