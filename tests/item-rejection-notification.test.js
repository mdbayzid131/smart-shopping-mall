const assert = require('node:assert/strict');
const test = require('node:test');

const { NotificationEvent } = require('../dist/app/modules/notification/notification.event.js');
const { NotificationService } = require('../dist/app/modules/notification/notification.service.js');

const cases = [
  [
    'Prohibited item',
    "We've reviewed your listing and unfortunately this item isn't eligible for listing on Closeté.",
  ],
  [
    'Poor-quality images',
    "We've reviewed your listing and unfortunately the photos don't meet Closeté's quality standards.",
  ],
  [
    'Inaccurate information',
    "We've reviewed your listing and unfortunately the listing details don't accurately represent the item.",
  ],
];

for (const [reason, expectedBody] of cases) {
  test(`item rejection uses the canonical ${reason} message`, async t => {
    let payload;
    t.mock.method(NotificationService, 'safeCreateNotification', async value => {
      payload = value;
      return value;
    });

    await NotificationEvent.itemRejected('seller-1', 'product-1', reason);

    assert.equal(payload.title, 'Item not published');
    assert.equal(payload.body, expectedBody);
    assert.equal(payload.data.rejectionCode, reason);
    assert.equal(payload.data.rejectionNote, undefined);
  });
}

test('item rejection preserves a separately identifiable admin note', async t => {
  let payload;
  t.mock.method(NotificationService, 'safeCreateNotification', async value => {
    payload = value;
    return value;
  });

  await NotificationEvent.itemRejected(
    'seller-1',
    'product-1',
    'Prohibited item: This category is not supported',
  );

  assert.equal(
    payload.body,
    "We've reviewed your listing and unfortunately this item isn't eligible for listing on Closeté. Additional note: This category is not supported",
  );
  assert.equal(payload.data.rejectionCode, 'Prohibited item');
  assert.equal(payload.data.rejectionNote, 'This category is not supported');
});
