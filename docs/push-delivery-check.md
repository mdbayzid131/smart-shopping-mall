# Internal-testing push delivery verification

The notification list API and unread count prove that records exist. They do not prove that Firebase delivered a push to the installed device.

1. On the tester's installed app, check Android Settings > Apps > Closete > Notifications, including the Closeté Updates channel. Android 13+ needs notification permission. Record the installed app version/build.
2. After installing/updating the fixed app, open the signed-in home screen. Device registration now runs after app bindings are ready, retries transient failures at 10/20/40 seconds, and coalesces concurrent callers. Successful registration is cached for six hours in the running app. Login, token rotation, app restart, and real app resume can recover a missed registration. It does not poll notification APIs.
3. App logs should show `[PUSH] Permission=...` and `[PUSH] Device registration platform=android status=200 success=true`. No raw FCM tokens are logged. If the permission is denied, enable it in Settings and reopen the app.
4. Trigger one real event for that tester's account, first with the app foregrounded, then with it backgrounded. Verify the banner, in-app row, and unread total. Numeric launcher badges depend on launcher support.
5. Server logs now distinguish `[FCM] No active registered device`, Firebase messaging disabled, and per-device delivery failure codes. `messaging/mismatched-credential` / `messaging/sender-id-mismatch` indicate Firebase-project credentials to investigate; invalid/unregistered tokens are removed and can register again.

The Firebase project in the Flutter options and Android `google-services.json` must match the deployed backend's Firebase service account. Checking local configuration does not validate the deployed server.

The existing launcher-based notification icon is preserved; a resource keep rule prevents release shrinking from removing it. No alternate brand icon or additional large logo is used. Local notification setup failures no longer stop remote message listeners or token registration. Increase the Play version code before uploading a replacement internal-testing bundle.
