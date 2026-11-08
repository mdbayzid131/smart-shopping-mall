/* eslint-disable no-unused-vars */
export enum ORDER_STATUS {
  PENDING_PAYMENT = 'pending_payment',
  RESERVED = 'reserved',
  SECURED = 'reserved',
  COLLECTION_PENDING = 'collection_pending',
  COLLECTED = 'collected',
  VERIFICATION = 'verification',
  PAYOUT_PROCESSING = 'payout_processing',
  READY_FOR_DELIVERY = 'ready_for_delivery',
  DISPATCHED = 'dispatched',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}

export enum PAYMENT_STATUS {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PAYOUT_STATUS {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PAID = 'paid',
  FAILED = 'failed',
  REVERSED = 'reversed',
}

/**
 * Typed operational outcomes that carry refund, notification, and account
 * standing rules beyond a normal order status transition.
 */
export enum ORDER_OUTCOME {
  AUTHENTICATION_FAILED = 'authentication_failed',
  COUNTERFEIT = 'counterfeit',
  SELLER_UNAVAILABLE = 'seller_unavailable',
  BUYER_UNAVAILABLE = 'buyer_unavailable',
  BUYER_CANCELLED = 'buyer_cancelled',
  SELLER_CANCELLED = 'seller_cancelled',
  NOT_AS_DESCRIBED = 'not_as_described',
  CONDITION_DIFFERS = 'condition_differs',
  BUYER_CHANGED_MIND = 'buyer_changed_mind',
  OTHERS = 'others',
}
