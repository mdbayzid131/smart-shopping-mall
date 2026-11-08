const { MongoClient } = require('mongodb');

async function migrate() {
  const uri = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/smart-shopping-mall';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();

    // 1. Find all orders with non-CLT orderNumber or matching ORD-
    const ordOrders = await db.collection('orders').find({
      orderNumber: { $regex: '^ORD-' }
    }).toArray();

    console.log(`Found ${ordOrders.length} orders with ORD- format.`);

    // Mapping from old orderNumber to new orderNumber
    const mapping = {};

    for (const order of ordOrders) {
      // Extract the digits (e.g. ORD-2026-101 -> 101 or 2026101)
      const numMatch = order.orderNumber.match(/\d+/g);
      const suffix = numMatch ? numMatch.join('') : Math.floor(10000000000 + Math.random() * 90000000000).toString();
      // Format as CLT- with 11 digits to match standard format e.g. CLT-20260000101
      const paddedSuffix = suffix.padStart(11, '0').slice(-11);
      const newOrderNumber = `CLT-${paddedSuffix}`;

      mapping[order.orderNumber] = newOrderNumber;

      await db.collection('orders').updateOne(
        { _id: order._id },
        { $set: { orderNumber: newOrderNumber } }
      );
      console.log(`Order ${order._id}: ${order.orderNumber} -> ${newOrderNumber}`);
    }

    // 2. Update issues that reference the old orderNumber
    for (const [oldNum, newNum] of Object.entries(mapping)) {
      const issueUpdateResult = await db.collection('issues').updateMany(
        { orderNumber: oldNum },
        { $set: { orderNumber: newNum } }
      );
      if (issueUpdateResult.modifiedCount > 0) {
        console.log(`Updated ${issueUpdateResult.modifiedCount} issues with old orderNumber ${oldNum} -> ${newNum}`);
      }
    }

    // 3. Update any notifications that mention old orderNumber
    for (const [oldNum, newNum] of Object.entries(mapping)) {
      await db.collection('notifications').updateMany(
        { 'data.orderNumber': oldNum },
        { $set: { 'data.orderNumber': newNum } }
      );
    }

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.close();
  }
}

migrate();
