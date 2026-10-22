const assert = require('node:assert/strict');
const test = require('node:test');
const { User } = require('../dist/app/modules/user/user.model.js');
const stripe = require('../dist/integrations/stripe.js');
const { ConnectService } = require('../dist/app/modules/payment/connect.service.js');
const { NotificationService } = require('../dist/app/modules/notification/notification.service.js');
const { Notification } = require('../dist/app/modules/notification/notification.model.js');

function setup(t, { connected = true, ready = false } = {}) {
  const notifications = [];
  const user = { _id: 'seller-1', stripeAccountId: connected ? 'acct_1' : undefined };
  const account = { id: 'acct_1', details_submitted: ready, payouts_enabled: ready };
  let notifiedAccount;
  t.mock.method(User, 'findOne', () => ({ select: async () => user }));
  t.mock.method(stripe, 'retrieveConnectedAccount', async () => account);
  t.mock.method(Notification, 'exists', async () => null);
  t.mock.method(User, 'updateOne', async (filter, mutation) => {
    if (mutation.$unset) { notifiedAccount = undefined; return { modifiedCount: 1 }; }
    if (notifiedAccount === filter.stripePayoutNotifiedAccountId.$ne) return { modifiedCount: 0 };
    notifiedAccount = mutation.$set.stripePayoutNotifiedAccountId;
    return { modifiedCount: 1 };
  });
  const capture = async payload => { notifications.push(payload); return payload; };
  t.mock.method(NotificationService, 'safeCreateNotification', capture);
  t.mock.method(NotificationService, 'createNotification', capture);
  return { notifications, account };
}

for (const connected of [false, true]) {
  test(`reservation reminds only the unverified seller (connected: ${connected})`, async t => {
    const { notifications } = setup(t, { connected });
    await ConnectService.notifyPayoutRequiredForReservation('seller-1', 'order-1');
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].recipientId, 'seller-1');
    assert.equal(notifications[0].title, 'Verify payout details');
    assert.equal(notifications[0].eventKey, 'order:order-1:payout-verification-required');
    assert.equal(notifications[0].data.section, 'payout_details');
  });
}

test('verified sellers receive no reminder and repeated status checks notify once', async t => {
  const { notifications } = setup(t, { ready: true });
  await Promise.all([
    ConnectService.notifyPayoutRequiredForReservation('seller-1', 'order-1'),
    ConnectService.accountStatus('seller-1'),
    ConnectService.accountStatus('seller-1'),
  ]);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].title, 'Payout details verified');
  assert.equal(notifications[0].recipientId, 'seller-1');
  assert.equal(notifications[0].data.section, 'payout_details');
  await ConnectService.accountUpdated('acct_1');
  assert.equal(notifications.length, 1);
});

test('notification failure can retry without marking payout status unverified', async t => {
  const { notifications } = setup(t, { ready: true });
  const send = t.mock.method(NotificationService, 'createNotification', async () => { throw new Error('temporary failure'); });
  const status = await ConnectService.accountStatus('seller-1');
  assert.equal(status.payoutsEnabled, true);
  send.mock.restore();
  await ConnectService.accountStatus('seller-1');
  assert.equal(notifications.length, 1);
});

test('Stripe outage does not produce a false verify reminder', async t => {
  const { notifications } = setup(t);
  t.mock.method(stripe, 'retrieveConnectedAccount', async () => { throw new Error('unavailable'); });
  await ConnectService.notifyPayoutRequiredForReservation('seller-1', 'order-1');
  assert.deepEqual(notifications, []);
});

test('an existing verification notification is not repeated after upgrading', async t => {
  const { notifications } = setup(t, { ready: true });
  t.mock.method(Notification, 'exists', async () => ({ _id: 'legacy-notice' }));
  await ConnectService.accountStatus('seller-1');
  await ConnectService.accountStatus('seller-1');
  assert.deepEqual(notifications, []);
});
