const assert = require('node:assert/strict');
const test = require('node:test');
const sift = require('sift').default;
const { Types } = require('mongoose');
const { buildConfirmedOrderFilter } = require('../dist/app/modules/order/order-history.util');
const nodemailer = require('nodemailer');
test.mock.method(nodemailer, 'createTransport', () => ({ verify: () => {}, sendMail: async () => ({}) }));
const { OrderService } = require('../dist/app/modules/order/order.service');
const { Order } = require('../dist/app/modules/order/order.model');
const { Product } = require('../dist/app/modules/product/product.model');
const { NotificationEvent } = require('../dist/app/modules/notification/notification.event');
const stripe = require('../dist/integrations/stripe');

test('buyer and seller histories exclude abandoned wallets but retain genuine cancellations', () => {
  const rows = [
    { id: 'wallet-open', status: 'pending_payment', payment: { status: 'pending' } },
    { id: 'wallet-closed', status: 'cancelled', payment: { status: 'pending' } },
    { id: 'failed', status: 'cancelled', payment: { status: 'failed' } },
    { id: 'paid', status: 'reserved', payment: { status: 'paid' } },
    { id: 'delivered', status: 'delivered', payment: { status: 'paid' } },
    { id: 'cancelled-after-payment', status: 'cancelled', payment: { status: 'refunded' } },
    { id: 'refunded', status: 'refunded', payment: { status: 'refunded' } },
  ].map(row => ({ ...row, buyer: 'buyer-1', seller: 'seller-1' }));
  for (const scope of [{ buyer: 'buyer-1' }, { seller: 'seller-1' }]) {
    assert.deepEqual(rows.filter(sift(buildConfirmedOrderFilter(scope))).map(row => row.id),
      ['paid', 'delivered', 'cancelled-after-payment', 'refunded']);
  }
  assert.deepEqual(rows.filter(sift(buildConfirmedOrderFilter({ buyer: 'someone-else' }))), []);
});

test('unpaid wallet cancellation releases the item without cancellation or wishlist alerts', async t => {
  const buyer = new Types.ObjectId();
  const order = {
    _id: new Types.ObjectId(), buyer, product: new Types.ObjectId(), status: 'pending_payment',
    payment: { status: 'pending', paymentIntentId: 'pi_pending' },
  };
  t.mock.method(Order, 'findById', async () => order);
  t.mock.method(Order, 'findOneAndUpdate', async () => ({ ...order, status: 'cancelled' }));
  const release = t.mock.method(Product, 'findOneAndUpdate', async () => ({ status: 'live' }));
  const cancel = t.mock.method(stripe, 'cancelPaymentIntent', async () => ({}));
  const refund = t.mock.method(stripe, 'createRefund', async () => ({}));
  const notify = t.mock.method(NotificationEvent, 'orderStatusChanged', async () => {});
  const wishlist = t.mock.method(NotificationEvent, 'wishlistAvailabilityChanged', async () => {});
  await OrderService.cancelOrder(order._id.toString(), buyer.toString());
  assert.equal(cancel.mock.callCount(), 1);
  assert.equal(refund.mock.callCount(), 0);
  assert.equal(release.mock.calls[0].arguments[1].$set.status, 'live');
  assert.equal(notify.mock.callCount(), 0);
  assert.equal(wishlist.mock.callCount(), 0);
});

test('paid cancellations still refund the buyer and notify the order parties', async t => {
  const buyer = new Types.ObjectId();
  const order = {
    _id: new Types.ObjectId(), buyer, product: new Types.ObjectId(), status: 'reserved',
    payment: { status: 'paid', paymentIntentId: 'pi_paid' }, statusHistory: [], save: async () => {},
  };
  t.mock.method(Order, 'findById', async () => order);
  t.mock.method(Product, 'findByIdAndUpdate', async () => ({ status: 'live' }));
  const refund = t.mock.method(stripe, 'createRefund', async () => ({}));
  const notify = t.mock.method(NotificationEvent, 'orderStatusChanged', async () => {});
  t.mock.method(NotificationEvent, 'wishlistAvailabilityChanged', async () => {});
  await OrderService.cancelOrder(order._id.toString(), buyer.toString());
  assert.equal(refund.mock.callCount(), 1);
  assert.equal(order.payment.status, 'refunded');
  assert.equal(order.status, 'cancelled');
  assert.equal(notify.mock.callCount(), 1);
});

test('buyer and seller pagination totals count confirmed orders only', async t => {
  const rows = [
    { _id: 'paid', buyer: 'buyer-1', seller: 'seller-1', status: 'reserved', payment: { status: 'paid' } },
    { _id: 'refund', buyer: 'buyer-1', seller: 'seller-1', status: 'cancelled', payment: { status: 'refunded' } },
    { _id: 'abandoned', buyer: 'buyer-1', seller: 'seller-1', status: 'cancelled', payment: { status: 'pending' } },
    { _id: 'pending', buyer: 'buyer-1', seller: 'seller-1', status: 'pending_payment', payment: { status: 'pending' } },
    { _id: 'another-user', buyer: 'buyer-2', seller: 'seller-2', status: 'reserved', payment: { status: 'paid' } },
  ];
  class Query {
    constructor(filter) { this.filter = filter; this.offset = 0; this.size = 20; this.model = Order; }
    sort() { return this; }
    skip(value) { this.offset = value; return this; }
    limit(value) { this.size = value; return this; }
    select() { return this; }
    populate() { return this; }
    getFilter() { return this.filter; }
    async lean() { return rows.filter(sift(this.filter)).slice(this.offset, this.offset + this.size); }
  }
  t.mock.method(Order, 'find', filter => new Query(filter));
  t.mock.method(Order, 'countDocuments', async filter => rows.filter(sift(filter)).length);
  for (const [userId, role] of [['buyer-1', 'buyer'], ['seller-1', 'seller']]) {
    const response = await OrderService.getMyOrders(userId, role, { page: '2', limit: '1' });
    assert.equal(response.meta.total, 2);
    assert.equal(response.meta.totalPage, 2);
    assert.deepEqual(response.result.map(order => order._id), ['refund']);
  }
});
