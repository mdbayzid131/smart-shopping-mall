import { Types } from 'mongoose';
import { z } from 'zod';
import { User } from './user.model';
import { normalizePagination } from '../../builder/QueryBuilder';
import { cache } from '../../../helpers/cache';
import { retrieveConnectedAccount } from '../../../integrations/stripe';
import ApiError from '../../../errors/ApiError';
import { USER_ROLES } from '../../../enums/user';
import { NOTIFICATION_TYPE } from '../../../enums/notification';
import { NotificationService } from '../notification/notification.service';

export const customerStatusSchema = z.object({
  params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }),
  body: z.discriminatedUnion('status', [
    z.object({ status: z.literal('suspended'), reason: z.string().trim().min(5).max(500) }).strict(),
    z.object({ status: z.literal('active') }).strict(),
  ]),
});

const list = async (query: Record<string, unknown>) => {
  const { page, limit } = normalizePagination({ ...query, limit: query.limit ?? 20 });
  const role = String(query.kind ?? 'all');
  if (!['all', 'sellers', 'buyers'].includes(role)) throw new ApiError(400, 'Invalid customer filter');
  const search = String(query.search ?? '').trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rows = await User.aggregate([
    { $match: { role: USER_ROLES.USER, ...(search ? { $or: [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }] } : {}) } },
    { $lookup: { from: 'products', let: { userId: '$_id' }, pipeline: [
      { $match: { $expr: { $eq: ['$seller', '$$userId'] } } },
      { $group: { _id: null, count: { $sum: 1 }, firstListedAt: { $min: '$createdAt' } } },
    ], as: 'selling' } },
    { $lookup: { from: 'orders', let: { userId: '$_id' }, pipeline: [
      { $match: { $expr: { $eq: ['$buyer', '$$userId'] }, 'payment.status': { $in: ['paid', 'refunded'] } } },
      { $limit: 1 }, { $project: { _id: 1 } },
    ], as: 'buying' } },
    { $lookup: { from: 'orders', let: { userId: '$_id' }, pipeline: [
      { $match: { $expr: { $eq: ['$seller', '$$userId'] }, outcome: 'counterfeit' } },
      { $count: 'count' },
    ], as: 'counterfeit' } },
    ...(role === 'sellers' ? [{ $match: { 'selling.0': { $exists: true } } }] : role === 'buyers' ? [{ $match: { 'buying.0': { $exists: true } } }] : []),
    { $sort: { createdAt: -1, _id: -1 } },
    { $facet: { count: [{ $count: 'total' }], items: [
      { $skip: (page - 1) * limit }, { $limit: limit },
      { $project: { name: 1, email: 1, phone: 1, contact: 1, location: 1, status: 1, statusReason: 1,
        failedAuthentications: { $ifNull: ['$failedAuthentications', 0] }, stripeAccountId: 1,
        firstListedAt: { $ifNull: ['$sellingStartedAt', { $arrayElemAt: ['$selling.firstListedAt', 0] }] },
        counterfeitItems: { $ifNull: [{ $arrayElemAt: ['$counterfeit.count', 0] }, 0] },
        isSeller: { $gt: [{ $size: '$selling' }, 0] }, isBuyer: { $gt: [{ $size: '$buying' }, 0] },
      } },
    ] } },
  ]);
  const total = rows[0]?.count[0]?.total ?? 0;
  const items = await Promise.all((rows[0]?.items ?? []).map(async (customer: any) => {
    const { stripeAccountId, ...safe } = customer;
    let payoutStatus = 'not_connected';
    if (stripeAccountId) {
      try {
        payoutStatus = await cache.getOrSet(`customers:payout:${stripeAccountId}`, 60_000, async () => {
          const account = await retrieveConnectedAccount(stripeAccountId);
          return account.payouts_enabled ? 'verified' : 'verification_required';
        });
      } catch { payoutStatus = 'unavailable'; }
    }
    return { ...safe, payoutStatus };
  }));
  return { items, pagination: { total, page, limit, totalPage: Math.ceil(total / limit) } };
};

const suspend = async (id: string, reason: string, adminId: string) => {
  const user = await User.findOneAndUpdate({ _id: new Types.ObjectId(id), role: USER_ROLES.USER,
    status: { $in: ['active', 'restricted'] } }, { $set: { status: 'suspended', statusReason: reason,
      statusChangedAt: new Date(), statusChangedBy: new Types.ObjectId(adminId) } }, { new: true })
    .select('name email status statusReason');
  if (!user) throw new ApiError(409, 'Customer is missing or already suspended. Refresh the list.');
  await NotificationService.safeCreateNotification({
    recipientId: id,
    type: NOTIFICATION_TYPE.ACCOUNT_SUSPENDED,
    title: 'Account suspended',
    body: `Your Closeté account has been suspended. Reason: ${reason}`,
    eventKey: `customer:${id}:suspended:${Date.now()}`,
    data: { screen: 'login', accountStatus: 'suspended', reason },
  });
  return user;
};
const unsuspend = async (id: string, adminId: string) => {
  const user = await User.findOneAndUpdate(
    { _id: new Types.ObjectId(id), role: USER_ROLES.USER, status: 'suspended' },
    {
      $set: {
        status: 'active',
        statusChangedAt: new Date(),
        statusChangedBy: new Types.ObjectId(adminId),
      },
      $unset: { statusReason: 1 },
    },
    { new: true },
  ).select('name email status statusReason');
  if (!user) {
    throw new ApiError(
      409,
      'Customer is missing or is not currently suspended. Refresh the list.',
    );
  }
  await NotificationService.safeCreateNotification({
    recipientId: id,
    type: NOTIFICATION_TYPE.ACCOUNT_RESTORED,
    title: 'Account restored',
    body: 'Your Closeté account has been reactivated. You can now sign in and use the app again.',
    eventKey: `customer:${id}:restored:${Date.now()}`,
    data: { screen: 'login', accountStatus: 'active' },
  });
  return user;
};
export const CustomerService = { list, suspend, unsuspend };
