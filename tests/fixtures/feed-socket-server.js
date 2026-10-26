// Loopback-only transport fixture. No database, Firebase, Stripe or real users.
const http = require('node:http');
const readline = require('node:readline');
const { Server } = require('socket.io');
const { jwtHelper } = require('../../dist/helpers/jwtHelper');
const { User } = require('../../dist/app/modules/user/user.model');
const { socketHelper } = require('../../dist/helpers/socketHelper');
const {
  synchronizeProductStatusMutation, publishProductDeleted,
} = require('../../dist/app/modules/product/product-state-sync');

jwtHelper.verifyToken = token => {
  if (token !== 'feed-test-token') throw new Error('Invalid fixture token');
  return { id: '000000000000000000000001' };
};
User.exists = async () => true;
const server = http.createServer();
const io = new Server(server);
socketHelper.socket(io);
server.listen(0, '127.0.0.1', () => {
  process.stdout.write(`FEED_TEST_PORT=${server.address().port}\n`);
});
const input = readline.createInterface({ input: process.stdin });
let commands = Promise.resolve();
input.on('line', command => { commands = commands.then(async () => {
  if (command === 'delete') {
    publishProductDeleted('product-1');
  } else if (command === 'reserve' || command === 'live') {
    await synchronizeProductStatusMutation(Promise.resolve({ id: 'product-1' }), {
      productId: 'product-1', status: command === 'reserve' ? 'reserved' : 'live',
    });
  } else if (command === 'disconnect') {
    for (const socket of io.sockets.sockets.values()) socket.conn.close();
  }
}); });
input.on('close', () => io.close(() => server.close()));
