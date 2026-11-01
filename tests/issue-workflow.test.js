const assert = require('node:assert/strict');
const test = require('node:test');
const { Types } = require('mongoose');
const nodemailer = require('nodemailer');
test.mock.method(nodemailer, 'createTransport', () => ({ verify() {}, sendMail: async () => { throw Error('Unexpected email'); } }));
const { IssueService } = require('../dist/app/modules/issue/issue.service');
const { OrderService } = require('../dist/app/modules/order/order.service');
const { Order } = require('../dist/app/modules/order/order.model');
const { Issue } = require('../dist/app/modules/issue/issue.model');
const { Product } = require('../dist/app/modules/product/product.model');
const { User } = require('../dist/app/modules/user/user.model');
const { UserPenaltyService } = require('../dist/app/modules/user/user-penalty.service');
const { NotificationEvent } = require('../dist/app/modules/notification/notification.event');
const { NotificationService } = require('../dist/app/modules/notification/notification.service');
const stripe = require('../dist/integrations/stripe');
const { assertIssueStage, issueActions } = require('../dist/app/modules/issue/issue-workflow');
const { ORDER_STATUS_TRANSITIONS } = require('../dist/app/modules/order/order.constant');

function fixture(t, status) {
  const state = { issue: null, events: [], products: [], refunds: [], penalties: [] };
  state.order = { _id: new Types.ObjectId(), product: new Types.ObjectId(), buyer: new Types.ObjectId(),
    seller: new Types.ObjectId(), orderNumber: 'CLT-fixture', status,
    price: 2500, sellerPayout: 2200, payoutStatus: 'pending', statusHistory: [],
    payment: { status: 'paid', paymentIntentId: 'pi_fixture' }, save: async () => {} };
  state.admin = new Types.ObjectId().toString();
  t.mock.method(Order.collection, 'findOneAndUpdate', async () => ({}));
  t.mock.method(Order.collection, 'updateOne', async () => ({}));
  t.mock.method(Order, 'updateOne', async () => { delete state.order.activeIssue; });
  t.mock.method(Order, 'findById', async () => state.order);
  t.mock.method(Issue, 'exists', async () => state.issue?.resolved === false ? { _id: state.issue._id } : null);
  t.mock.method(Issue, 'findOne', async () => state.issue?.resolved === false ? state.issue : null);
  t.mock.method(Issue, 'findById', async () => state.issue);
  t.mock.method(Issue, 'create', async data => {
    state.issue = { ...data, _id: new Types.ObjectId(), save: async () => {} };
    return state.issue;
  });
  t.mock.method(Product, 'findByIdAndUpdate', async (_id, update) => { state.products.push(update); return {}; });
  t.mock.method(stripe, 'createRefund', async (...args) => { state.refunds.push(args); return {}; });
  t.mock.method(UserPenaltyService, 'recordSellerOffence', async (...args) => state.penalties.push(args));
  for (const name of ['authenticationFailed', 'deliveryRejected', 'orderCancellation', 'orderStatusChanged', 'issueResolved', 'deliveryReattempted']) {
    t.mock.method(NotificationEvent, name, async (...args) => state.events.push({ name, args }));
  }
  state.report = (type, outcome) => IssueService.createIssue(state.order.product.toString(), state.order._id.toString(), type, outcome, 'Admin supplied reason', state.admin);
  state.resolve = action => IssueService.resolveIssue(state.issue._id.toString(), action, state.admin);
  return state;
}

for (const [status, type, outcome, action] of [
  ['reserved', 'seller_unavailable', 'seller_unavailable', 'retry_collection'],
  ['dispatched', 'buyer_unavailable', 'buyer_unavailable', 'retry_delivery'],
]) test(`${outcome} retains payment/status and retries without refund or relisting`, async t => {
  const f = fixture(t, status);
  await f.report(type, outcome);
  assert.equal(f.issue.resolved, false);
  assert.equal(f.order.status, status);
  assert.equal(f.order.payment.status, 'paid');
  assert.ok(f.order.activeIssue);
  await assert.rejects(OrderService.updateOrderStatus(f.order._id.toString(), 'delivered', undefined, f.admin), /Resolve the active issue/);
  await f.resolve(action);
  assert.equal(f.issue.resolved, true);
  assert.equal(f.order.activeIssue, undefined);
  assert.equal(f.order.status, status);
  assert.equal(f.order.payment.status, 'paid');
  assert.deepEqual(f.products, []);
  assert.deepEqual(f.refunds, []);
  assert.deepEqual(f.penalties, []);
  assert.deepEqual(f.events.map(e => e.name), action === 'retry_delivery' ? ['deliveryReattempted'] : []);
});

for (const outcome of ['buyer_cancelled', 'seller_cancelled']) {
  for (const status of ['reserved', 'collected', 'verification']) test(`${outcome} from ${status} refunds fully and never relists`, async t => {
    const f = fixture(t, status);
    await f.report('cancellation', outcome);
    assert.equal(f.order.status, 'refunded');
    assert.equal(f.refunds.length, 1);
    assert.equal(f.refunds[0][2], 2500);
    assert.equal(f.order.handlingFeeCharged, 0);
    assert.equal(f.products[0].$set.status, 'rejected');
    assert.equal(f.order.returnStatus, status === 'reserved' ? 'with_seller' : 'awaiting_return');
    assert.equal(f.issue.resolved, true);
    assert.deepEqual(f.penalties, []);
    assert.deepEqual(f.events.map(e => e.name), ['orderCancellation']);
  });
}

test('failed authentication refunds, delists, records exactly one order offence and notifies both parties event', async t => {
  const f = fixture(t, 'collected');
  await f.report('verification_failed', 'authentication_failed');
  assert.equal(f.refunds[0][2], 2500);
  assert.equal(f.products[0].$set.status, 'rejected');
  assert.equal(f.penalties[0][2], f.order._id.toString());
  assert.deepEqual(f.events.map(e => e.name), ['authenticationFailed']);
});

for (const action of ['dispatch', 'cancel_order']) test(`condition mismatch waits for manual ${action}`, async t => {
  const f = fixture(t, 'collected');
  await f.report('condition_differs', 'condition_differs');
  assert.equal(f.refunds.length, 0);
  assert.equal(f.order.conditionNote, 'Admin supplied reason');
  await f.resolve(action);
  await f.resolve(action); // replay must not refund twice
  assert.equal(f.refunds.length, action === 'cancel_order' ? 1 : 0);
  assert.equal(f.order.status, action === 'dispatch' ? 'dispatched' : 'refunded');
  assert.equal(f.order.conditionNote, 'Admin supplied reason');
  assert.equal(f.events.filter(e => e.name === 'issueResolved').length, 0);
  assert.equal(f.events.filter(e => e.name === 'orderStatusChanged').length, action === 'dispatch' ? 1 : 0);
});

test('buyer changes mind at doorstep: refund without relisting or seller offence', async t => {
  const f = fixture(t, 'dispatched');
  await f.report('buyer_refused', 'buyer_changed_mind');
  assert.equal(f.refunds[0][2], 2500);
  assert.equal(f.order.returnStatus, 'awaiting_return');
  assert.equal(f.products[0].$set.status, 'rejected');
  assert.deepEqual(f.penalties, []);
});

test('stage guards reject wrong reasons, refunded retries and Delivered mutations', async t => {
  assert.throws(() => assertIssueStage('verification', 'authentication_failed'));
  assert.throws(() => assertIssueStage('collected', 'buyer_unavailable'));
  assert.deepEqual(issueActions('buyer_unavailable', 'refunded', false), []);
  assert.deepEqual(issueActions('seller_unavailable', 'collected', false), []);
  assert.deepEqual(issueActions('buyer_unavailable', 'reserved', false), []);
  assert.deepEqual(ORDER_STATUS_TRANSITIONS.delivered, []);
  const f = fixture(t, 'delivered');
  await assert.rejects(f.report('cancellation', 'buyer_cancelled'));
  assert.equal(f.refunds.length, 0);
});

test('two admin mutations cannot hold the order lease at once', async t => {
  const f = fixture(t, 'reserved');
  t.mock.method(Order.collection, 'findOneAndUpdate', async () => null);
  await assert.rejects(f.report('seller_unavailable', 'seller_unavailable'), /being updated/);
  assert.equal(f.issue, null);
  assert.equal(f.refunds.length, 0);
});

test('failed refund leaves an actionable issue and the retry uses the same order refund key', async t => {
  const f = fixture(t, 'collected');
  const attempts = [];
  t.mock.method(stripe, 'createRefund', async (...args) => {
    attempts.push(args);
    if (attempts.length === 1) throw new Error('Temporary provider failure');
    return {};
  });
  await assert.rejects(f.report('cancellation', 'seller_cancelled'), /Temporary provider/);
  assert.equal(f.issue.resolved, false);
  assert.equal(f.order.payment.status, 'paid');
  assert.equal(f.order.status, 'collected');
  assert.ok(f.order.activeIssue);
  await f.report('cancellation', 'seller_cancelled');
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0][1], attempts[1][1]);
  assert.equal(f.order.payment.status, 'refunded');
  assert.equal(f.issue.resolved, true);
});

test('order lease excludes a second live operation and is released after failure', async t => {
  const { withOrderWorkflowLock } = require('../dist/app/modules/order/order-workflow-lock');
  let held = false;
  let unlock;
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const wait = new Promise(resolve => { unlock = resolve; });
  t.mock.method(Order.collection, 'findOneAndUpdate', async () => {
    if (held) return null;
    held = true;
    return {};
  });
  t.mock.method(Order.collection, 'updateOne', async () => { held = false; });
  const id = new Types.ObjectId().toString();
  const first = withOrderWorkflowLock(id, async () => { entered(); await wait; return 'first'; });
  await started;
  await assert.rejects(withOrderWorkflowLock(id, async () => 'second'), /being updated/);
  unlock();
  assert.equal(await first, 'first');
  await assert.rejects(withOrderWorkflowLock(id, async () => { throw new Error('Operation failed'); }), /Operation failed/);
  assert.equal(await withOrderWorkflowLock(id, async () => 'recovered'), 'recovered');
});

test('redispatch notification targets only buyer with a stable key per retry issue', async t => {
  const payloads = [];
  t.mock.method(NotificationService, 'safeCreateNotification', async p => payloads.push(p));
  const order = { _id: 'order', buyer: 'buyer', seller: 'seller', product: 'product', orderNumber: 'CLT-test' };
  await NotificationEvent.deliveryReattempted(order, 'issue-1');
  await NotificationEvent.deliveryReattempted(order, 'issue-2');
  assert.deepEqual(payloads.map(p => p.recipientId), ['buyer', 'buyer']);
  assert.notEqual(payloads[0].eventKey, payloads[1].eventKey);
});

test('authentication count is per order, excludes unrelated offences, and blocks only at threshold', async t => {
  let count = 0;
  const seen = new Set();
  const suspensions = [];
  t.mock.method(User, 'findById', () => ({ select: async () => ({ failedAuthentications: count, status: 'active' }) }));
  t.mock.method(User, 'findOneAndUpdate', async (filter) => {
    const id = filter.authenticationFailureOrders.$ne;
    if (seen.has(id)) return null;
    seen.add(id); count++;
    return { failedAuthentications: count, status: 'active' };
  });
  t.mock.method(User, 'updateOne', async (...args) => suspensions.push(args));
  for (const id of ['first', 'first', 'second']) await UserPenaltyService.recordSellerOffence('seller', 'authentication_failed', id);
  assert.equal(count, 2);
  assert.equal(suspensions.length, 0);
  await UserPenaltyService.recordSellerOffence('seller', 'condition_differs', 'unrelated');
  assert.equal(count, 2);
  await UserPenaltyService.recordSellerOffence('seller', 'authentication_failed', 'third');
  assert.equal(suspensions.length, 1);
  assert.equal(suspensions[0][1].$set.status, 'suspended');
});
