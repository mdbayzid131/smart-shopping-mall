const mongoose = require('mongoose');

async function cleanProducts() {
  await mongoose.connect('mongodb://127.0.0.1:27017/smart-shopping-mall');
  console.log('Connected to MongoDB.');

  const db = mongoose.connection.db;

  const prodRes = await db.collection('products').deleteMany({});
  console.log(`Deleted ${prodRes.deletedCount} products.`);

  const orderRes = await db.collection('orders').deleteMany({});
  console.log(`Deleted ${orderRes.deletedCount} orders.`);

  if ((await db.listCollections({ name: 'issues' }).toArray()).length > 0) {
    const issueRes = await db.collection('issues').deleteMany({});
    console.log(`Deleted ${issueRes.deletedCount} issues.`);
  }

  if ((await db.listCollections({ name: 'wishlists' }).toArray()).length > 0) {
    const wishRes = await db.collection('wishlists').deleteMany({});
    console.log(`Deleted ${wishRes.deletedCount} wishlist entries.`);
  }

  if ((await db.listCollections({ name: 'notifications' }).toArray()).length > 0) {
    const notifRes = await db.collection('notifications').deleteMany({});
    console.log(`Deleted ${notifRes.deletedCount} notifications.`);
  }

  console.log('Database products, orders, issues, wishlists, and notifications cleaned successfully!');
  await mongoose.disconnect();
}

cleanProducts().catch((err) => {
  console.error('Error cleaning database:', err);
  process.exit(1);
});
