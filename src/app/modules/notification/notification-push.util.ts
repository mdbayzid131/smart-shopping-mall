import { MulticastMessage } from 'firebase-admin/messaging';

type PushNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt?: Date;
  data: Record<string, string>;
};

export const buildNotificationPush = (
  tokens: string[],
  unreadCount: number,
  notification?: PushNotification,
): MulticastMessage => ({
  tokens,
  ...(notification ? { notification: { title: notification.title, body: notification.body } } : {}),
  data: {
    ...(notification?.data ?? {}),
    ...(notification ? {
      notificationId: notification.id, type: notification.type,
      title: notification.title, body: notification.body,
      createdAt: notification.createdAt?.toISOString() ?? new Date().toISOString(),
    } : { type: 'notification_sync' }),
    unreadCount: String(unreadCount),
  },
  android: {
    priority: 'high',
    ...(notification ? { notification: {
      channelId: 'closete_updates', sound: 'default',
      tag: 'closete_unread', notificationCount: unreadCount,
    } } : {}),
  },
  apns: { payload: { aps: {
    badge: unreadCount,
    ...(notification ? { sound: 'default' } : { contentAvailable: true }),
  } } },
});
