/* eslint-disable @typescript-eslint/no-explicit-any */
import { ORDER_OUTCOME, ORDER_STATUS } from '../../../enums/order';
import { USER_ROLES } from '../../../enums/user';
import { ORDER_STATUS_TRANSITIONS } from './order.constant';

const STATUS_RANK: Record<ORDER_STATUS, number> = {
  [ORDER_STATUS.PENDING_PAYMENT]: 0,
  [ORDER_STATUS.SECURED]: 1,
  [ORDER_STATUS.COLLECTION_PENDING]: 1,
  [ORDER_STATUS.COLLECTED]: 2,
  [ORDER_STATUS.VERIFICATION]: 3,
  [ORDER_STATUS.PAYOUT_PROCESSING]: 3,
  [ORDER_STATUS.READY_FOR_DELIVERY]: 3,
  [ORDER_STATUS.DISPATCHED]: 4,
  [ORDER_STATUS.DELIVERED]: 5,
  [ORDER_STATUS.COMPLETED]: 5,
  [ORDER_STATUS.REFUNDED]: -1,
  [ORDER_STATUS.CANCELLED]: -1,
};

const CURRENT_PROGRESS: Record<
  ORDER_STATUS,
  { label: string; description: string }
> = {
  [ORDER_STATUS.PENDING_PAYMENT]: {
    label: 'Awaiting payment',
    description: 'Payment confirmation is pending',
  },
  [ORDER_STATUS.SECURED]: {
    label: 'Reserved',
    description: 'Payment is secured and pickup is being arranged',
  },
  [ORDER_STATUS.COLLECTION_PENDING]: {
    label: 'Pickup pending',
    description: 'The item is awaiting collection from the seller',
  },
  [ORDER_STATUS.COLLECTED]: {
    label: 'Collected',
    description: 'The item was collected and is awaiting authentication',
  },
  [ORDER_STATUS.VERIFICATION]: {
    label: 'Verification',
    description: 'Authentication is in progress',
  },
  [ORDER_STATUS.PAYOUT_PROCESSING]: {
    label: 'Verified',
    description: 'Authentication passed and seller payout is processing',
  },
  [ORDER_STATUS.READY_FOR_DELIVERY]: {
    label: 'Ready for delivery',
    description: 'The verified item is ready to be delivered',
  },
  [ORDER_STATUS.DISPATCHED]: {
    label: 'Dispatched',
    description: 'The item has been dispatched and is in transit to buyer',
  },
  [ORDER_STATUS.DELIVERED]: {
    label: 'Delivered',
    description: 'The item was delivered to the buyer',
  },
  [ORDER_STATUS.COMPLETED]: {
    label: 'Completed',
    description: 'The order is complete',
  },
  [ORDER_STATUS.REFUNDED]: {
    label: 'Refunded',
    description: 'The payment was refunded',
  },
  [ORDER_STATUS.CANCELLED]: {
    label: 'Cancelled',
    description: 'The order was cancelled',
  },
};

const toPlain = (value: any): any =>
  value && typeof value.toJSON === 'function' ? value.toJSON() : value;

const idOf = (value: any) =>
  String(value?._id ?? value?.id ?? value ?? '');

const currentStepFor = (status: ORDER_STATUS) => {
  if (
    status === ORDER_STATUS.SECURED ||
    status === ORDER_STATUS.COLLECTION_PENDING
  ) {
    return 'reserved';
  }
  if (status === ORDER_STATUS.COLLECTED) return 'collected';
  if (
    status === ORDER_STATUS.VERIFICATION ||
    status === ORDER_STATUS.PAYOUT_PROCESSING ||
    status === ORDER_STATUS.READY_FOR_DELIVERY
  ) {
    return 'authenticated';
  }
  if (status === ORDER_STATUS.DISPATCHED) {
    return 'dispatched';
  }
  if (
    status === ORDER_STATUS.DELIVERED ||
    status === ORDER_STATUS.COMPLETED
  ) {
    return 'delivered';
  }
  return null;
};

export const getOrderProgress = (
  status: ORDER_STATUS,
  statusHistory: Array<{ status: ORDER_STATUS; note?: string }> = [],
) => {
  const effectiveRank = Math.max(
    STATUS_RANK[status] ?? -1,
    ...statusHistory.map(item => STATUS_RANK[item.status] ?? -1),
  );
  const isCancelledOrRefunded =
    status === ORDER_STATUS.CANCELLED || status === ORDER_STATUS.REFUNDED;

  const currentStep = currentStepFor(status);
  const steps = [
    { key: 'reserved', label: 'Reserved', rank: 1 },
    { key: 'collected', label: 'Collected', rank: 2 },
    { key: 'authenticated', label: 'Authenticated', rank: 3 },
    { key: 'dispatched', label: 'Dispatched', rank: 4 },
    { key: 'delivered', label: 'Delivered', rank: 5 },
  ];

  return steps.map(step => {
    let state = 'pending';
    if (!isCancelledOrRefunded) {
      state =
        currentStep === step.key
          ? 'current'
          : effectiveRank >= step.rank
            ? 'completed'
            : 'pending';
    } else {
      if (effectiveRank > step.rank) {
        state = 'completed';
      } else if (effectiveRank === step.rank) {
        state = 'failed';
      } else {
        state = 'cancelled';
      }
    }
    return {
      key: step.key,
      label: step.label,
      state,
    };
  });
};

export const getVerificationState = (
  status: ORDER_STATUS,
  verificationFailed: boolean,
  wasVerified = false,
) => {
  if (verificationFailed) {
    return { status: 'failed', label: 'Verification failed', isVerified: false };
  }
  if (
    wasVerified ||
    status === ORDER_STATUS.PAYOUT_PROCESSING ||
    status === ORDER_STATUS.READY_FOR_DELIVERY ||
    status === ORDER_STATUS.DELIVERED ||
    status === ORDER_STATUS.COMPLETED
  ) {
    return { status: 'verified', label: 'Verified', isVerified: true };
  }
  if (status === ORDER_STATUS.VERIFICATION) {
    return {
      status: 'in_progress',
      label: 'Authentication pending',
      isVerified: false,
    };
  }
  return { status: 'pending', label: 'Not verified yet', isVerified: false };
};

export const getDeliveryState = (status: ORDER_STATUS) => {
  if (
    status === ORDER_STATUS.DELIVERED ||
    status === ORDER_STATUS.COMPLETED
  ) {
    return { status: 'delivered', label: 'Delivered' };
  }
  if (status === ORDER_STATUS.READY_FOR_DELIVERY) {
    return { status: 'ready_for_delivery', label: 'Ready for delivery' };
  }
  if (
    status === ORDER_STATUS.CANCELLED ||
    status === ORDER_STATUS.REFUNDED
  ) {
    return { status: 'not_applicable', label: 'Delivery cancelled' };
  }
  return { status: 'pending', label: 'Delivery pending' };
};

const normalizeParty = (party: any, fallback: any = {}) => {
  if (!party) return null;
  const value = toPlain(party);
  const resolvedPhone = value.phone || value.contact || fallback.phone || null;
  const country = value.country || fallback.country || 'UAE';
  let location = value.location || fallback.location || null;

  if (typeof location === 'string' && location.includes(',')) {
    const parts = location.split(',').map((p: string) => p.trim());
    if (parts.length > 1 && parts[parts.length - 1].toUpperCase() === 'UAE') {
      parts.pop();
      location = parts.join(', ') || null;
    }
  }

  return {
    _id: idOf(value),
    name: value.name ?? null,
    email: value.email ?? null,
    phone: resolvedPhone,
    contact: resolvedPhone,
    location,
    country: country || 'UAE',
    profileImage: value.avatar || value.image || value.profileImage || null,
  };
};

export const buildOrderDetails = ({
  order,
  openIssue,
  currency = 'AED',
}: {
  order: any;
  openIssue?: any;
  viewer?: { id: string; role: string };
  currency?: string;
}) => {
  const value = toPlain(order);
  const product = toPlain(value.product) ?? {};
  const deliveryDetails = value.deliveryDetails ?? {};
  const rawStatus = value.status;
  const status = rawStatus === 'secured' ? 'reserved' : rawStatus;
  const statusHistory = Array.isArray(value.statusHistory)
    ? value.statusHistory.map((h: any) => ({
        status: h.status === 'secured' ? 'reserved' : h.status,
        note: h.note || null,
        changedAt: h.changedAt,
      }))
    : [];

  return {
    _id: idOf(value),
    orderNumber: value.orderNumber,
    status,
    outcome: value.outcome || null,
    note: value.note || null,
    cancellationReason:
      value.cancellationReason || value.note || openIssue?.reason || null,
    progress: getOrderProgress(value.status, value.statusHistory),
    issue: openIssue
      ? {
          _id: idOf(openIssue),
          reason: openIssue.reason,
          issueType: openIssue.issueType,
          outcome: openIssue.outcome,
          resolved: Boolean(openIssue.resolved),
          createdAt: openIssue.createdAt,
        }
      : null,
    statusHistory,
    product: {
      _id: idOf(product),
      name: product.name ?? null,
      brand: product.brand ?? null,
      images:
        Array.isArray(product.images) && product.images.length > 0
          ? product.images
          : product.image
            ? [product.image]
            : [],
      price: product.price ?? value.price,
      currency: currency || 'AED',
      verified: Boolean(product.verified),
      condition: product.condition ?? product.details?.condition ?? null,
      description: product.description ?? product.details?.description ?? null,
      originalPackagingAvailable: Boolean(
        product.originalPackagingAvailable ?? product.details?.originalPackagingAvailable ?? false,
      ),
      proofOfPurchase: product.proofOfPurchase ?? null,
    },
    seller: normalizeParty(value.seller),
    buyer: normalizeParty(value.buyer, deliveryDetails),
    deliveryDetails: {
      address: deliveryDetails.address ?? null,
      location: deliveryDetails.location ?? null,
      phone: deliveryDetails.phone ?? null,
      country: deliveryDetails.country ?? 'UAE',
    },
    payment: {
      provider: value.payment?.provider ?? 'stripe',
      status: value.payment?.status ?? 'paid',
      payoutStatus: value.payoutStatus ?? 'pending',
    },
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};
