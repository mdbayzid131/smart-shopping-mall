const mongoose = require('mongoose');

async function migrate() {
  await mongoose.connect('mongodb://127.0.0.1:27017/smart-shopping-mall');
  const result = await mongoose.connection.db.collection('products').updateMany(
    { status: 'available' },
    { $set: { status: 'live' } }
  );
  console.log(`Updated ${result.modifiedCount} products from 'available' to 'live'`);
  await mongoose.disconnect();
}

migrate().catch(console.error);
