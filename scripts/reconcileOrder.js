require('dotenv').config();
const mongoose = require('mongoose');
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

async function reconcile() {
  await mongoose.connect('mongodb://127.0.0.1:27017/smart-shopping-mall');
  const order = await mongoose.connection.collection('orders').findOne({ orderNumber: 'CLT-96605899335' });
  if (order && order.payment && order.payment.paymentIntentId) {
    const pi = await stripe.paymentIntents.retrieve(order.payment.paymentIntentId);
    console.log('Stripe Payment Intent Status:', pi.status);
    if (pi.status === 'succeeded') {
      await mongoose.connection.collection('orders').updateOne(
        { _id: order._id },
        {
          $set: {
            status: 'secured',
            'payment.status': 'paid',
            updatedAt: new Date(),
          },
          $push: {
            statusHistory: {
              status: 'secured',
              changedAt: new Date(),
            }
          }
        }
      );
      await mongoose.connection.collection('products').updateOne(
        { _id: order.product },
        {
          $set: { status: 'reserved', buyer: order.buyer },
          $unset: { reservationExpiresAt: 1 }
        }
      );
      console.log('Successfully reconciled order to secured and payment to paid!');
    }
  }
  const updatedOrder = await mongoose.connection.collection('orders').findOne({ orderNumber: 'CLT-96605899335' });
  console.log('Updated order:', JSON.stringify(updatedOrder, null, 2));
  await mongoose.disconnect();
}
reconcile();
