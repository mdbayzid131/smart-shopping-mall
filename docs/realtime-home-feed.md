# Realtime home feed

The Flutter app connects to the API origin at `/socket.io/` using WebSocket
transport and its access token in `auth.token`. The existing server middleware
authenticates the connection. Reverse proxies must forward WebSocket upgrades.

- `product:status-changed`: `{ productId, status, changedAt }`. Only `live` and
  `available` products belong in the home feed. Reservation hides the card;
  cancelled/expired unpaid checkout can return it to `live`.
- `product:deleted`: `{ productId, status: "deleted", changedAt }`. Published
  after the database deletion succeeds and product caches are invalidated.
- New listings remain `pending_review`; approval publishes the existing status
  event that makes them eligible for the feed.

Flutter removes unavailable cards immediately, coalesces event bursts, and
reconciles loaded pages while retaining the visible product where possible.
Successful local purchases/deletions also update the feed without waiting for
the socket. Reconnect, foreground resume, return from item details/checkout,
return to the Home tab and pull-to-refresh reconcile with the API. No periodic
feed polling is added. Re-tapping the selected Home icon scrolls to the top.

The server's conditional `live`/`available` reservation update remains the
authority for concurrent checkout; socket delivery is not a purchase lock.

## Validation

Run `npm test` in this backend and `flutter test --no-pub` in `cpk1989`.
For the optional cross-repository transport check, after building the backend,
run from `cpk1989`:

```
flutter test --no-pub tool/tests/feed_socket_transport_test.dart
```

This starts a loopback-only Socket.IO fixture with stub authentication/database
lookups and verifies two actual Dart clients plus reconnection. It does not
connect to a real database or send payments/pushes. Physical Android/iOS and
deployment proxy testing remain separate from these automated checks.
