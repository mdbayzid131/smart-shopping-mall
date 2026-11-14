const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildOrderDetails,
  getDeliveryState,
  getOrderProgress,
  getVerificationState,
} = require('../dist/app/modules/order/order.presenter');

test('order progress exposes stable UI states', () => {
  const progress = getOrderProgress('verification', [
    { status: 'pending_payment' },
    { status: 'secured' },
    { status: 'collected' },
  ]);

  assert.deepEqual(
    progress.map(step => [step.key, step.state]),
    [
      ['reserved', 'completed'],
      ['collected', 'completed'],
      ['authenticated', 'current'],
      ['dispatched', 'pending'],
      ['delivered', 'pending'],
    ],
  );
  assert.deepEqual(getDeliveryState('verification'), {
    status: 'pending',
    label: 'Delivery pending',
  });
});

test('verification state distinguishes pending, verified, and failed orders', () => {
  assert.equal(getVerificationState('verification', false).status, 'in_progress');
  assert.equal(getVerificationState('delivered', false).isVerified, true);
  assert.equal(getVerificationState('cancelled', true).status, 'failed');
  assert.equal(getVerificationState('cancelled', false, true).isVerified, true);
});

test('order details include the UI contract and redact Stripe identifiers', () => {
  const result = buildOrderDetails({
    order: {
      _id: 'order-1',
      orderNumber: 'CLT-123',
      status: 'verification',
      price: 3200,
      platformFee: 384,
      sellerPayout: 2816,
      product: {
        _id: 'product-1',
        orderId: 347892,
        name: 'Gucci Diana Tote',
        brand: 'Gucci',
        images: ['https://example.com/gucci.jpg'],
        material: 'Black Leather',
        features: ['Bamboo Handle'],
        condition: 'Excellent',
        description: 'Item is in excellent condition',
        originalPackagingAvailable: true,
      },
      seller: {
        _id: 'seller-1',
        name: 'Seller',
        contact: '+971500000001',
        location: 'Dubai',
      },
      buyer: { _id: 'buyer-1', name: 'Buyer' },
      deliveryDetails: {
        address: '10 Test Street',
        location: 'Abu Dhabi',
        phone: '+971500000002',
      },
      payment: {
        provider: 'stripe',
        status: 'paid',
      },
      payoutStatus: 'paid',
    },
    currency: 'AED',
  });

  assert.equal(result.product.brand, 'Gucci');
  assert.equal(result.product.condition, 'Excellent');
  assert.equal(result.product.currency, 'AED');
  assert.equal(result.seller.phone, '+971500000001');
  assert.equal(result.buyer.phone, '+971500000002');
  assert.equal(result.buyer.location, 'Abu Dhabi');
  assert.equal(result.payment.provider, 'stripe');
  assert.equal(result.payment.status, 'paid');
});

