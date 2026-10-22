const assert = require('node:assert/strict');
const test = require('node:test');

const { Product } = require('../dist/app/modules/product/product.model.js');
const { Wishlist } = require('../dist/app/modules/wishlist/wishlist.model.js');
const { WishlistService } = require('../dist/app/modules/wishlist/wishlist.service.js');
const { NotificationService } = require('../dist/app/modules/notification/notification.service.js');
const { NOTIFICATION_TYPE } = require('../dist/enums/notification.js');
const { socketHelper } = require('../dist/helpers/socketHelper.js');

for (const sellerId of ['seller-1', 'buyer-1']) {
  test(`wishlist save notifies the saving user (seller: ${sellerId})`, async t => {
    const notifications = [];
    const created = { _id: 'wishlist-1', user: 'buyer-1', product: 'product-1' };
    t.mock.method(Product, 'findById', () => ({
      select: async () => ({ name: 'Bag', wishlistCount: 0, seller: sellerId }),
    }));
    const find = t.mock.method(Wishlist, 'findOne', async () => null);
    const create = t.mock.method(Wishlist, 'create', async payload => {
      assert.deepEqual(payload, { user: 'buyer-1', product: 'product-1' });
      return created;
    });
    t.mock.method(Wishlist, 'countDocuments', async () => 1);
    const update = t.mock.method(Product, 'updateOne', async () => ({}));
    t.mock.method(socketHelper, 'emitToAll', () => {});
    t.mock.method(NotificationService, 'safeCreateNotification', async payload => {
      notifications.push(payload);
    });

    const result = await WishlistService.addToWishlist('buyer-1', 'product-1');
    assert.equal(result.wishlistCount, 1);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].recipientId, 'buyer-1');
    assert.equal(notifications[0].type, NOTIFICATION_TYPE.WISHLIST_ITEM_SAVED);
    assert.equal(notifications[0].eventKey, 'wishlist:wishlist-1:saved');
    assert.deepEqual(notifications[0].data, {
      screen: 'product_details', productId: 'product-1',
    });
    assert.deepEqual(update.mock.calls[0].arguments, [
      { _id: 'product-1' }, { $set: { wishlistCount: 1 } },
    ]);

    // Retrying an existing save must not notify anyone again.
    find.mock.mockImplementation(async () => created);
    await WishlistService.addToWishlist('buyer-1', 'product-1');
    assert.equal(create.mock.callCount(), 1);
    assert.equal(notifications.length, 1);
  });
}
