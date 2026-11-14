const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const migrate = async () => {
  await mongoose.connect(databaseUrl);
  const db = mongoose.connection.db;

  const productUpdates = [
    ['available', 'live'],
    ['secured', 'reserved'],
    ['under_review', 'pending_review'],
    ['delivered', 'sold'],
  ];

  for (const [from, to] of productUpdates) {
    const result = await db.collection('products').updateMany(
      { status: from },
      { $set: { status: to } },
    );
    console.log(`Products: ${from} -> ${to}: ${result.modifiedCount}`);
  }

  const orderUpdates = [
    ['secured', 'reserved'],
    ['collection_pending', 'reserved'],
    ['payout_processing', 'verification'],
    ['ready_for_delivery', 'verification'],
    ['completed', 'delivered'],
    ['refunded', 'cancelled'],
  ];

  for (const [from, to] of orderUpdates) {
    const result = await db.collection('orders').updateMany(
      { status: from },
      { $set: { status: to } },
    );
    const historyResult = await db.collection('orders').updateMany(
      { 'statusHistory.status': from },
      { $set: { 'statusHistory.$[entry].status': to } },
      { arrayFilters: [{ 'entry.status': from }] },
    );
    console.log(`Orders: ${from} -> ${to}: ${result.modifiedCount} current, ${historyResult.modifiedCount} history`);
  }

  await mongoose.disconnect();
};

migrate().catch(async error => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
