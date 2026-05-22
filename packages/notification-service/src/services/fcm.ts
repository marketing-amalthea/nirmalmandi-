/**
 * Firebase Cloud Messaging (FCM) for push notifications.
 * Uses Firebase Admin SDK — supports iOS and Android.
 */
import admin from 'firebase-admin';
import { logger } from '@nirmalmandi/shared';

let initialized = false;

function getApp(): admin.app.App {
  if (!initialized) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    initialized = true;
  }
  return admin.app();
}

export interface PushNotification {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export async function sendPush(notification: PushNotification): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    logger.info('[DEV] FCM push skipped', { title: notification.title });
    return;
  }
  try {
    const app = getApp();
    await app.messaging().send({
      token: notification.token,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data: notification.data,
      android: {
        priority: 'high',
        notification: { sound: 'default', clickAction: 'FLUTTER_NOTIFICATION_CLICK' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    });
  } catch (err) {
    logger.error('FCM push failed', { token: notification.token.slice(0, 20), error: err });
    throw err;
  }
}

export async function sendMulticast(tokens: string[], title: string, body: string, data?: Record<string, string>): Promise<void> {
  if (tokens.length === 0) return;
  if (process.env.NODE_ENV === 'development') {
    logger.info('[DEV] FCM multicast skipped', { count: tokens.length, title });
    return;
  }
  try {
    const app = getApp();
    const response = await app.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data,
    });
    if (response.failureCount > 0) {
      logger.warn('FCM multicast partial failure', {
        sent: response.successCount,
        failed: response.failureCount,
      });
    }
  } catch (err) {
    logger.error('FCM multicast failed', { error: err });
  }
}
