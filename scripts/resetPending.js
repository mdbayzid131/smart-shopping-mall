const mongoose = require('mongoose');

async function reset() {
  await mongoose.connect('mongodb://127.0.0.1:27017/smart-shopping-mall');
  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
  await Product.updateOne({ orderId: 1009 }, { $set: { status: 'pending_review', rejectionReason: null } });
  await Product.updateOne({ orderId: 1010 }, { $set: { status: 'pending_review', rejectionReason: null } });
  console.log('✅ Reset mock products 1009 and 1010 to pending_review');
  process.exit(0);
}

reset();
