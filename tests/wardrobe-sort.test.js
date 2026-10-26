const assert = require('node:assert/strict');
const test = require('node:test');
const sift = require('sift').default;
const { Types } = require('mongoose');
const { Product } = require('../dist/app/modules/product/product.model');
const { Order } = require('../dist/app/modules/order/order.model');
const { ProductService } = require('../dist/app/modules/product/product.service');

// Execute the small subset of Mongo stages used here against fixtures, without a database.
function evaluate(expression, row) {
  if (typeof expression === 'string' && expression.startsWith('$')) return row[expression.slice(1)];
  if (!expression || typeof expression !== 'object') return expression;
  if (expression.$in) return expression.$in[1].includes(evaluate(expression.$in[0], row));
  if (expression.$switch) {
    const branch = expression.$switch.branches.find(branch => evaluate(branch.case, row));
    return branch ? branch.then : expression.$switch.default;
  }
  throw new Error('Unexpected aggregation expression');
}
function aggregate(rows, pipeline) {
  let result = rows.map(row => ({ ...row }));
  for (const stage of pipeline) {
    if (stage.$match) result = result.filter(sift(stage.$match));
    else if (stage.$addFields) result = result.map(row => ({ ...row,
      ...Object.fromEntries(Object.entries(stage.$addFields).map(([key, expression]) => [key, evaluate(expression, row)])),
    }));
    else if (stage.$sort) result.sort((a, b) => {
      for (const [key, direction] of Object.entries(stage.$sort)) {
        if (a[key] < b[key]) return -direction;
        if (a[key] > b[key]) return direction;
      }
      return 0;
    });
    else if (stage.$skip !== undefined) result = result.slice(stage.$skip);
    else if (stage.$limit !== undefined) result = result.slice(0, stage.$limit);
    else if (stage.$unset) result.forEach(row => delete row[stage.$unset]);
    else if (stage.$project) {
      // Default projection excludes __v; custom projections are not used in these fixtures.
      assert.deepEqual(stage.$project, { __v: 0 });
    } else throw new Error('Unexpected aggregation stage');
  }
  return result;
}

test('wardrobe sorts review first, newest unsold next and sold last across pages', async t => {
  const seller = new Types.ObjectId();
  const rows = [
    ['sold-new', 'sold', '2026-10-26'],
    ['live-old', 'live', '2026-10-20'],
    ['review-old', 'pending_review', '2026-10-21'],
    ['reserved-new', 'reserved', '2026-10-25'],
    ['review-new', 'under_review', '2026-10-24'],
    ['sold-old', 'sold', '2026-10-19'],
  ].map(([name, status, date]) => ({ _id: new Types.ObjectId(), seller, name, status,
    createdAt: new Date(date), price: 100, images: [] }));
  rows.push({ _id: new Types.ObjectId(), seller: new Types.ObjectId(), name: 'another seller',
    status: 'pending_review', createdAt: new Date('2026-10-27') });
  t.mock.method(Product, 'aggregate', async pipeline => aggregate(rows, pipeline));
  t.mock.method(Product, 'countDocuments', async filter => rows.filter(sift(filter)).length);
  t.mock.method(Order, 'find', () => ({ select() { return this; }, sort() { return this; }, lean: async () => [] }));

  const names = [];
  for (let page = 1; page <= 3; page++) {
    const response = await ProductService.getMyProductsFromDB(seller.toString(), { page: String(page), limit: '2' });
    assert.equal(response.meta.total, 6);
    assert.equal(response.meta.totalPage, 3);
    names.push(...response.result.map(row => row.name));
  }
  assert.deepEqual(names, ['review-new', 'review-old', 'reserved-new', 'live-old', 'sold-new', 'sold-old']);

  const filtered = await ProductService.getMyProductsFromDB(seller.toString(), { status: 'live' });
  assert.deepEqual(filtered.result.map(row => row.name), ['live-old']);
  assert.equal(filtered.meta.total, 1);

  const otherSeller = rows.at(-1).seller.toString();
  const protectedResult = await ProductService.getMyProductsFromDB(seller.toString(), { seller: otherSeller });
  assert.equal(protectedResult.meta.total, 0);
  assert.deepEqual(protectedResult.result, []);
});
