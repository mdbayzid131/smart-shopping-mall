/* eslint-disable no-console */
require('dotenv').config();

const mongoose = require('mongoose');
const Stripe = require('stripe');

const EXECUTE = process.argv.includes('--execute');
const CONFIRMATION = process.env.TEST_DATA_RESET_CONFIRMATION;
const EXPECTED_CONFIRMATION = 'RESET_CLIENT_TEST_DATA';

const productFixtures = [
  ['Chanel Classic Flap Bag', 'Chanel', 34500, 'pending_review'],
  ['Rolex Datejust 36', 'Rolex', 42000, 'pending_review'],
  ['Hermes Constance 24', 'Hermes', 68000, 'pending_review'],
  ['Cartier Love Bracelet', 'Cartier', 26500, 'pending_review'],
  ['Dior Lady Bag', 'Dior', 22000, 'pending_review'],
  ['Bottega Veneta Cassette', 'Bottega Veneta', 11500, 'pending_review'],
  ['Van Cleef Alhambra Necklace', 'Van Cleef & Arpels', 31500, 'pending_review'],
  ['Fendi Peekaboo ISeeU', 'Fendi', 18500, 'pending_review'],
  ['Louis Vuitton Capucines', 'Louis Vuitton', 24000, 'live'],
  ['Gucci Jackie 1961', 'Gucci', 9800, 'live'],
  ['Prada Galleria Bag', 'Prada', 12500, 'live'],
  ['Saint Laurent Lou Camera Bag', 'Saint Laurent', 7200, 'live'],
  ['Balenciaga Hourglass Bag', 'Balenciaga', 10500, 'live'],
  ['Tiffany T Wire Bracelet', 'Tiffany & Co.', 14500, 'live'],
  ['Celine Triomphe Bag', 'Celine', 17500, 'reserved'],
  ['Omega Seamaster Watch', 'Omega', 28500, 'reserved'],
  ['Loewe Puzzle Bag', 'Loewe', 13500, 'reserved'],
  ['Bvlgari Serpenti Watch', 'Bvlgari', 38000, 'reserved'],
];

const imageUrls = [
  'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1575032617751-6ddec2089882?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=1000&q=80',
];

const id = value => new mongoose.Types.ObjectId(value);

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');

  await mongoose.connect(databaseUrl);
  const db = mongoose.connection.db;
  const usersCollection = db.collection('users');
  const users = await usersCollection
    .find({ role: 'USER' })
    .project({ name: 1, email: 1, stripeAccountId: 1, stripeCustomerId: 1 })
    .sort({ createdAt: 1 })
    .toArray();

  if (users.length < 2) {
    throw new Error('At least two customer accounts are required to create reciprocal reservations.');
  }

  const before = {};
  for (const collection of ['products', 'orders', 'issues', 'wishlists', 'notifications']) {
    before[collection] = await db.collection(collection).countDocuments({});
  }

  console.log(JSON.stringify({
    mode: EXECUTE ? 'execute' : 'dry-run',
    customers: users.map(user => ({
      id: String(user._id),
      name: user.name,
      email: user.email,
      hasStripeCustomer: Boolean(user.stripeCustomerId),
      hasStripePayoutAccount: Boolean(user.stripeAccountId),
    })),
    before,
    plannedProducts: {
      pendingReview: 8,
      live: 6,
      reserved: 4,
    },
  }, null, 2));

  if (!EXECUTE) {
    console.log('Dry run only. Pass --execute with TEST_DATA_RESET_CONFIRMATION to apply.');
    return;
  }
  if (CONFIRMATION !== EXPECTED_CONFIRMATION) {
    throw new Error(`Set TEST_DATA_RESET_CONFIRMATION=${EXPECTED_CONFIRMATION} before executing.`);
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  if (!stripeKey.startsWith('sk_test_')) {
    throw new Error('Refusing to delete Stripe data unless STRIPE_SECRET_KEY is a test-mode key.');
  }
  const stripe = new Stripe(stripeKey);

  // Remove external test-mode payment methods and payout details first. If any
  // deletion fails, the database is left untouched so the reset can be retried.
  for (const user of users) {
    if (user.stripeCustomerId) {
      const deleted = await stripe.customers.del(user.stripeCustomerId);
      console.log(`Deleted Stripe customer for ${user.email}: ${deleted.id}`);
    }
    if (user.stripeAccountId) {
      const deleted = await stripe.accounts.del(user.stripeAccountId);
      console.log(`Deleted Stripe payout account for ${user.email}: ${deleted.id}`);
    }
  }

  await Promise.all([
    db.collection('issues').deleteMany({}),
    db.collection('orders').deleteMany({}),
    db.collection('wishlists').deleteMany({}),
    db.collection('notifications').deleteMany({}),
  ]);
  await db.collection('products').deleteMany({});

  await usersCollection.updateMany(
    { role: 'USER' },
    {
      $set: {
        status: 'active',
        sellerStrikes: 0,
        failedAuthentications: 0,
        authenticationFailureOrders: [],
        missedCollections: 0,
        buyerUnjustifiedRejections: 0,
      },
      $unset: {
        stripeAccountId: '',
        stripePayoutNotifiedAccountId: '',
        stripeCustomerId: '',
        statusReason: '',
        statusChangedBy: '',
        statusChangedAt: '',
      },
    },
  );

  const sellers = users.slice(0, Math.min(3, users.length));
  const now = Date.now();
  const products = productFixtures.map((fixture, index) => {
    const [name, brand, price, status] = fixture;
    const seller = sellers[index % sellers.length];
    const buyer = status === 'reserved'
      ? sellers[(index + 1) % sellers.length]
      : null;
    const createdAt = new Date(now - index * 60_000);
    return {
      _id: new mongoose.Types.ObjectId(),
      orderId: 5001 + index,
      name,
      brand,
      description: `${name} test listing for the complete operations dashboard workflow.`,
      material: index % 2 === 0 ? 'Leather' : 'Premium mixed material',
      price,
      condition: index % 3 === 0 ? 'Like New' : 'Excellent',
      originalPackagingAvailable: index % 2 === 0,
      packaging: index % 2 === 0 ? 'Original packaging available' : 'Protective packaging',
      images: [
        imageUrls[index % imageUrls.length],
        imageUrls[(index + 1) % imageUrls.length],
        imageUrls[(index + 2) % imageUrls.length],
      ],
      status,
      rejectionReason: null,
      reviewedBy: null,
      reviewedAt: status === 'live' || status === 'reserved' ? createdAt : null,
      commissionAmount: Math.round(price * 0.12),
      sellerEarnings: Math.round(price * 0.88),
      collectionAddress: seller.location || 'Dubai, UAE',
      sellerPhone: seller.phone || seller.contact || '+971 50 000 0000',
      wishlistCount: 0,
      seller: seller._id,
      ...(buyer ? { buyer: buyer._id } : {}),
      ...(status === 'reserved' ? { reservationExpiresAt: new Date(now + 24 * 60 * 60 * 1000) } : {}),
      createdAt,
      updatedAt: createdAt,
    };
  });
  await db.collection('products').insertMany(products);

  const reservedProducts = products.filter(product => product.status === 'reserved');
  const orders = reservedProducts.map((product, index) => {
    const createdAt = new Date(now - index * 60_000);
    return {
      orderNumber: `CLT-TEST-${String(index + 1).padStart(4, '0')}`,
      product: product._id,
      buyer: product.buyer,
      seller: product.seller,
      price: product.price,
      platformFee: Math.round(product.price * 0.12),
      sellerPayout: Math.round(product.price * 0.88),
      note: 'Seeded reservation for admin workflow testing.',
      deliveryDetails: {
        address: 'Test delivery address, Dubai',
        location: 'Dubai',
        phone: '+971 50 000 0000',
        country: 'UAE',
      },
      payment: {
        provider: 'stripe',
        paymentIntentId: `pi_test_dashboard_${Date.now()}_${index}`,
        status: 'paid',
      },
      payoutStatus: 'pending',
      status: 'reserved',
      statusHistory: [{ status: 'reserved', note: 'Seeded paid reservation', changedAt: createdAt }],
      createdAt,
      updatedAt: createdAt,
    };
  });
  await db.collection('orders').insertMany(orders);

  await usersCollection.updateMany(
    { _id: { $in: sellers.map(seller => id(seller._id)) } },
    { $set: { sellingStartedAt: new Date(now) } },
  );

  const after = {
    products: await db.collection('products').countDocuments({}),
    pendingReview: await db.collection('products').countDocuments({ status: 'pending_review' }),
    live: await db.collection('products').countDocuments({ status: 'live' }),
    reserved: await db.collection('products').countDocuments({ status: 'reserved' }),
    orders: await db.collection('orders').countDocuments({ status: 'reserved' }),
    issues: await db.collection('issues').countDocuments({}),
    wishlists: await db.collection('wishlists').countDocuments({}),
    notifications: await db.collection('notifications').countDocuments({}),
  };
  console.log(JSON.stringify({ success: true, after }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
