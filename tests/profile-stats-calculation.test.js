const assert = require('node:assert/strict');
const test = require('node:test');
const { Types } = require('mongoose');
const sift = require('sift').default;
const { User } = require('../dist/app/modules/user/user.model');
const { Product } = require('../dist/app/modules/product/product.model');
const { Order } = require('../dist/app/modules/order/order.model');
// Importing UserService must not contact the SMTP provider in a stats test.
const nodemailer = require('nodemailer');
test.mock.method(nodemailer, 'createTransport', () => ({
  verify: () => {},
  sendMail: async () => { throw new Error('Unexpected email in profile stats test'); },
}));
const { UserService } = require('../dist/app/modules/user/user.service');

test('profile keeps purchases, completed sales, inventory value and paid earnings separate', async t => {
  const id = new Types.ObjectId();
  t.mock.method(User, 'findById', () => ({ select: () => ({ lean: async () => ({ _id: id, status: 'active', verified: true }) }) }));
  t.mock.method(Product, 'countDocuments', async filter => {
    assert.deepEqual(filter, { seller: id.toString() });
    return 7;
  });
  t.mock.method(Order, 'countDocuments', async filter => {
    assert.equal(filter.buyer, id.toString());
    assert.equal(filter['payment.status'], 'paid');
    assert.deepEqual(filter.status.$nin, ['cancelled', 'refunded']);
    return 2;
  });
  t.mock.method(Order, 'aggregate', async pipeline => {
    assert.equal(pipeline[0].$match.seller, id);
    assert.equal(pipeline[0].$match['payment.status'], 'paid');
    assert.deepEqual(pipeline[0].$match.status.$nin, ['cancelled', 'refunded']);
    const group = pipeline[1].$group;
    // A delivered sale counts even while its seller payout is still pending.
    assert.deepEqual(group.totalProductsSold.$sum.$cond[0].$in, ['$status', ['delivered', 'completed']]);
    assert.equal(group.totalSalesValue.$sum.$cond[1], '$price');
    assert.deepEqual(group.totalEarnings.$sum.$cond[0].$eq, ['$payoutStatus', 'paid']);
    return [{ totalProductsSold: 1, totalSalesValue: 800, totalEarnings: 0 }];
  });
  t.mock.method(Product, 'aggregate', async pipeline => {
    assert.equal(pipeline[0].$match.seller, id);
    const statuses = ['pending_review', 'live', 'rejected', 'reserved', 'collected',
      'authenticated', 'dispatched', 'delivered', 'sold', 'available', 'secured', 'under_review'];
    const records = statuses.map(status => ({ seller: id, status, price: 100 }));
    records.push({ seller: new Types.ObjectId(), status: 'live', price: 999 });
    const included = records.filter(sift(pipeline[0].$match));
    assert.deepEqual(included.map(product => product.status), statuses.filter(status => status !== 'sold'));
    assert.equal(pipeline[1].$group.closetValue.$sum, '$price');
    return [{ closetValue: 1234.5 }];
  });
  const result = await UserService.getProfileStatsFromDB(id.toString());
  assert.equal(result.totalProductsListed, 7);
  assert.equal(result.totalProductsPurchased, 2);
  assert.equal(result.totalProductsSold, 1);
  assert.equal(result.totalSalesValue, 800);
  assert.equal(result.totalEarnings, 0);
  assert.equal(result.closetValue, 1234.5);
});

test('a profile with no sales or listings returns genuine zero values', async t => {
  const id = new Types.ObjectId();
  t.mock.method(User, 'findById', () => ({ select: () => ({ lean: async () => ({ _id: id, status: 'active', verified: true }) }) }));
  t.mock.method(Product, 'countDocuments', async () => 0);
  t.mock.method(Order, 'countDocuments', async () => 0);
  t.mock.method(Product, 'aggregate', async () => []);
  t.mock.method(Order, 'aggregate', async () => []);
  const result = await UserService.getProfileStatsFromDB(id.toString());
  for (const key of ['totalProductsListed', 'totalProductsPurchased', 'totalProductsSold', 'closetValue', 'totalSalesValue', 'totalEarnings']) {
    assert.equal(result[key], 0, key);
  }
});
