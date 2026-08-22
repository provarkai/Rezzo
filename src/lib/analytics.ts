// ============================================================
// REZZO Analytics Events (PRD §22 — funnel/KPI tracking)
// ============================================================
//
// Always logs structurally (see logger.ts) — that alone is real and
// queryable from server logs with zero setup. Additionally forwards to
// PostHog's capture API when POSTHOG_API_KEY is set, same "inert until
// configured" pattern as Paystack/WhatsApp: no PostHog project was
// available while building this, so the forward path is written against
// PostHog's documented HTTP API but hasn't been exercised against a real
// project. Never throws and never blocks the action it's attached to —
// same discipline as notify()/logAdminAction().

import { logger } from './logger';

export function isPostHogConfigured(): boolean {
  return !!process.env.POSTHOG_API_KEY;
}

export interface TrackEventParams {
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
}

export async function trackEvent({ event, distinctId, properties }: TrackEventParams): Promise<void> {
  logger.info(`event:${event}`, { distinctId, ...properties });

  if (!isPostHogConfigured()) return;
  try {
    const host = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';
    await fetch(`${host}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.POSTHOG_API_KEY,
        event,
        distinct_id: distinctId,
        properties,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    logger.warn('PostHog forward failed', { error: err, event });
  }
}
