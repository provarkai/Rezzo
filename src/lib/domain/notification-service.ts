// ============================================================
// REZZO Notification Service
// ============================================================
//
// V1 is in-app only — there's no push/email/SMS/WhatsApp provider wired
// up, so every notification lands as an APP-channel row a user reads
// inside the product. The shape (channel/type/status/payload/readAt)
// matches what a real multi-channel NotificationChannel adapter would
// need, so wiring a provider later is additive, not a rewrite.

import { db } from '@/lib/db';

export interface NotifyParams {
  userId: string;
  caseId?: string | null;
  type: string;
  title: string;
  body?: string;
}

/**
 * Create a notification. Callers should wrap this in try/catch — a
 * notification failing to send should never block the action that
 * triggered it (a quote still gets sent even if notifying about it fails).
 */
export async function notify({ userId, caseId, type, title, body }: NotifyParams) {
  return db.notification.create({
    data: {
      userId,
      caseId: caseId ?? null,
      channel: 'APP',
      type,
      status: 'DELIVERED', // no delivery pipeline to track in V1; created = delivered
      payloadJson: { title, body: body ?? null } as object,
    },
  });
}

export async function notifyMany(userIds: string[], params: Omit<NotifyParams, 'userId'>) {
  const uniqueIds = [...new Set(userIds)];
  return Promise.all(uniqueIds.map((userId) => notify({ ...params, userId })));
}
