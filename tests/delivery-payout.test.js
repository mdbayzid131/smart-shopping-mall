const assert = require('node:assert/strict');
const test = require('node:test');
const { Types } = require('mongoose');
const nodemailer = require('nodemailer');

test.mock.method(nodemailer, 'createTransport', () => ({
  verify() {},
  sendMail: async () => { throw Error('Unexpected email'); },
}));

const { OrderService } = require('../dist/app/modules/order/order.service');
const { Order } = require('../dist/app/modules/order/order.model');
const { Issue } = require('../dist/app/modules/issue/issue.model');
const { Product } = require('../dist/app/modules/product/product.model');
const { User } = require('../dist/app/modules/user/user.model');
const { NotificationEvent } = require('../dist/app/modules/notification/notification.event');
const stripe = require('../dist/integrations/stripe');

function fixture(t) {
  const state = { transfers: 0, products: [], events: [], saves: [] };
  state.order = {
    _id: new Types.ObjectId(),
    product: new Types.ObjectId(),
    buyer: new Types.ObjectId(),
    seller: new Types.ObjectId(),
    orderNumber: 'CLT-delivery-payout',
    status: 'dispatched',
    price: 2500,
    sellerPayout: 2200,
    payoutStatus: 'pending',
    statusHistory: [],
    payment: { status: 'paid', paymentIntentId: 'pi_delivery' },
    save: async function () {
      state.saves.push({ status: this.status, payoutStatus: this.payoutStatus });
    },
  };
  state.admin = new Types.ObjectId().toString();

  t.mock.method(Order.collection, 'findOneAndUpdate', async () => ({}));
  t.mock.method(Order.collection, 'updateOne', async () => ({}));
  t.mock.method(Order, 'findById', async () => state.order);
  t.mock.method(Issue, 'exists', async () => null);
  t.mock.method(User, 'findById', () => ({
    select: async () => ({ stripeAccountId: 'acct_seller' }),
  }));
  t.mock.method(Product, 'findByIdAndUpdate', async (_id, update) => {
    state.products.push(update);
    return {};
  });
  t.mock.method(stripe, 'retrieveConnectedAccount', async () => ({
    details_submitted: true,
    payouts_enabled: true,
  }));
  t.mock.method(stripe, 'createSellerTransfer', async () => {
    state.transfers += 1;
    return { id: 'tr_delivery' };
  });
  for (const name of ['orderStatusChanged', 'payoutPaid']) {
    t.mock.method(NotificationEvent, name, async () => state.events.push(name));
  }
  return state;
}

test('delivery confirmation pays once, sells the product and records delivery', async t => {
  const f = fixture(t);
  const result = await OrderService.confirmDeliveryAndPayout(
    f.order._id.toString(),
    f.admin,
  );

  assert.equal(result.status, 'delivered');
  assert.equal(result.payoutStatus, 'paid');
  assert.equal(result.payoutTransferId, 'tr_delivery');
  assert.equal(f.transfers, 1);
  assert.equal(f.products[0].$set.status, 'sold');
  assert.equal(result.statusHistory.at(-1).changedBy, f.admin);
  assert.deepEqual(f.events, ['orderStatusChanged', 'payoutPaid']);

  await OrderService.confirmDeliveryAndPayout(f.order._id.toString(), f.admin);
  assert.equal(f.transfers, 1, 'a repeated confirmation must not create another payout');
});

test('failed payout keeps the order dispatched and records an actionable failure', async t => {
  const f = fixture(t);
  stripe.createSellerTransfer.mock.mockImplementationOnce(async () => {
    f.transfers += 1;
    throw new Error('Stripe transfer unavailable');
  });

  await assert.rejects(
    OrderService.confirmDeliveryAndPayout(f.order._id.toString(), f.admin),
    /Stripe transfer unavailable/,
  );
  assert.equal(f.order.status, 'dispatched');
  assert.equal(f.order.payoutStatus, 'failed');
  assert.equal(f.order.payoutFailureReason, 'Stripe transfer unavailable');
  assert.deepEqual(f.products, []);
  assert.deepEqual(f.events, []);
});

test('generic status endpoint cannot bypass automatic delivery payout', async t => {
  const f = fixture(t);
  await assert.rejects(
    OrderService.updateOrderStatus(
      f.order._id.toString(),
      'delivered',
      undefined,
      f.admin,
    ),
    /confirm-delivery action/,
  );
  assert.equal(f.transfers, 0);
  assert.equal(f.order.status, 'dispatched');
});
