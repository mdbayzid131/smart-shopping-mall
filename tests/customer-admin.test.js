const assert = require('node:assert/strict');
const test = require('node:test');
const { Types } = require('mongoose');
const { User } = require('../dist/app/modules/user/user.model');
const { CustomerService, customerStatusSchema } = require('../dist/app/modules/user/customer.service');
const stripe = require('../dist/integrations/stripe');
const { NotificationService } = require('../dist/app/modules/notification/notification.service');

test('customer status mutation requires a suspension reason and allows only a safe reactivation', () => {
  const params = { id: new Types.ObjectId().toString() };
  assert.equal(customerStatusSchema.safeParse({ params, body: { status: 'suspended', reason: 'Manual review required' } }).success, true);
  assert.equal(customerStatusSchema.safeParse({ params, body: { status: 'active' } }).success, true);
  for (const body of [{ status: 'active', reason: 'Bypass' }, { status: 'restricted' }, { status: 'suspended', reason: '' }, { status: 'suspended', reason: 'Review', role: 'ADMIN' }]) {
    assert.equal(customerStatusSchema.safeParse({ params, body }).success, false);
  }
});

test('manual unsuspension only reactivates a suspended customer and clears the reason', async t => {
  const admin = new Types.ObjectId().toString();
  const id = new Types.ObjectId().toString();
  let filter; let update;
  t.mock.method(User, 'findOneAndUpdate', (query, mutation) => {
    filter = query; update = mutation;
    return { select: async () => ({ _id: id, status: 'active' }) };
  });
  let notification;
  t.mock.method(NotificationService, 'safeCreateNotification', async payload => { notification = payload; });
  const result = await CustomerService.unsuspend(id, admin);
  assert.equal(result.status, 'active');
  assert.equal(filter.role, 'USER');
  assert.equal(filter.status, 'suspended');
  assert.equal(update.$set.status, 'active');
  assert.equal(update.$set.statusChangedBy.toString(), admin);
  assert.equal(update.$unset.statusReason, 1);
  assert.equal(notification.recipientId, id);
  assert.equal(notification.type, 'account_restored');
  assert.equal(notification.data.accountStatus, 'active');
});

test('customer listing exposes safe fields and honest payout status with bounded pagination', async t => {
  let pipeline;
  t.mock.method(User, 'aggregate', async value => {
    pipeline = value;
    return [{ count: [{ total: 1 }], items: [{ _id: new Types.ObjectId(), email: 'fixture@example.test',
      stripeAccountId: 'acct_customer_fixture', failedAuthentications: 2, counterfeitItems: 0 }] }];
  });
  t.mock.method(stripe, 'retrieveConnectedAccount', async () => ({ payouts_enabled: false }));
  const result = await CustomerService.list({ kind: 'sellers', search: '.*', limit: '9999' });
  assert.equal(result.pagination.limit, 100);
  assert.equal(result.items[0].payoutStatus, 'verification_required');
  assert.equal(result.items[0].stripeAccountId, undefined);
  assert.equal(result.items[0].failedAuthentications, 2);
  assert.equal(result.items[0].counterfeitItems, 0);
  assert.equal(pipeline[0].$match.role, 'USER');
  assert.equal(pipeline[0].$match.$or[0].name.$regex, '\\.\\*');
  assert.ok(pipeline.some(stage => stage.$match?.['selling.0']?.$exists));
  await assert.rejects(CustomerService.list({ kind: 'admins' }), /Invalid customer filter/);
});

test('manual suspension targets customers only and records administrator and reason', async t => {
  const admin = new Types.ObjectId().toString();
  const id = new Types.ObjectId().toString();
  let filter; let update;
  t.mock.method(User, 'findOneAndUpdate', (query, mutation) => {
    filter = query; update = mutation;
    return { select: async () => ({ _id: id, status: 'suspended' }) };
  });
  let notification;
  t.mock.method(NotificationService, 'safeCreateNotification', async payload => { notification = payload; });
  const result = await CustomerService.suspend(id, 'Policy review required', admin);
  assert.equal(result.status, 'suspended');
  assert.equal(filter.role, 'USER');
  assert.deepEqual(filter.status.$in, ['active', 'restricted']);
  assert.equal(update.$set.statusReason, 'Policy review required');
  assert.equal(update.$set.statusChangedBy.toString(), admin);
  assert.ok(update.$set.statusChangedAt instanceof Date);
  assert.equal(notification.recipientId, id);
  assert.equal(notification.type, 'account_suspended');
  assert.match(notification.body, /Policy review required/);
});
