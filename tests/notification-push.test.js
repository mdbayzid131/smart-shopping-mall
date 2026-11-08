const assert = require('node:assert/strict');
const test = require('node:test');
const { buildNotificationPush } = require('../dist/app/modules/notification/notification-push.util.js');

test('iOS and Android pushes contain the same absolute unread count and list data', () => {
  const message = buildNotificationPush(['token'], 5, {
    id: 'n1', title: 'Saved', body: 'Item saved', type: 'wishlist_item_saved',
    data: { screen: 'product_details', productId: 'p1' },
    createdAt: new Date('2026-10-22T00:00:00Z'),
  });
  assert.equal(message.data.unreadCount, '5');
  assert.equal(message.apns.payload.aps.badge, 5);
  assert.equal(message.android.notification.notificationCount, 5);
  assert.equal(message.data.notificationId, 'n1');
  assert.equal(message.data.title, 'Saved');
  assert.equal(message.data.createdAt, '2026-10-22T00:00:00.000Z');
  assert.equal(message.android.notification.tag, 'closete_unread');
});

test('read/delete sync clears badges without creating another visible notification', () => {
  const message = buildNotificationPush(['token'], 0);
  assert.equal(message.notification, undefined);
  assert.equal(message.android.notification, undefined);
  assert.equal(message.data.type, 'notification_sync');
  assert.equal(message.data.unreadCount, '0');
  assert.equal(message.apns.payload.aps.badge, 0);
  assert.equal(message.apns.payload.aps.sound, undefined);
  assert.equal(message.apns.payload.aps.contentAvailable, true);
});
