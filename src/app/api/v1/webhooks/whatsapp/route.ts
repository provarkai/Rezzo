import { NextRequest, NextResponse } from 'next/server';
import { handleInboundWhatsAppMessage } from '@/lib/domain/whatsapp-service';
import {
  verifyWhatsAppSignature,
  sendWhatsAppMessage,
  isWhatsAppConfigured,
} from '@/lib/domain/messaging-providers/whatsapp';
import { logger } from '@/lib/logger';

// Meta's one-time webhook verification handshake — it calls this with the
// verify token you set on the app dashboard; echo back hub.challenge
// verbatim if it matches, or the subscription never activates.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === 'subscribe' && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

// Inbound messages. No REZZO auth token here — WhatsApp calls this
// directly, so trust comes entirely from the HMAC signature (see
// verifyWhatsAppSignature). Always read the raw body first; parsing JSON
// before verifying (or re-serializing before hashing) can silently break
// the signature check.
export async function POST(request: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return new NextResponse('Bad request', { status: 400 });
  }

  const signature = request.headers.get('x-hub-signature-256');
  if (!verifyWhatsAppSignature(rawBody, signature)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const payload = JSON.parse(rawBody);
    const messages: unknown[] =
      payload?.entry?.[0]?.changes?.[0]?.value?.messages || [];

    for (const raw of messages) {
      const msg = raw as {
        from?: string;
        type?: string;
        text?: { body?: string };
      };
      if (!msg.from) continue;

      const contacts = payload?.entry?.[0]?.changes?.[0]?.value?.contacts as
        | Array<{ profile?: { name?: string } }>
        | undefined;

      try {
        const { replyText } = await handleInboundWhatsAppMessage({
          fromPhone: msg.from,
          messageType: msg.type || 'unknown',
          text: msg.text?.body,
          displayName: contacts?.[0]?.profile?.name,
        });

        // The case/message is already recorded regardless — the reply is a
        // courtesy, and there's no point attempting one (or throwing) if
        // the send credentials were never configured.
        if (isWhatsAppConfigured()) {
          try {
            await sendWhatsAppMessage(msg.from, replyText);
          } catch (err) {
            // Reply is best-effort — sending failed, but the case stands.
            logger.warn('WhatsApp reply send failed', { error: err });
          }
        }
      } catch (err) {
        // One malformed message shouldn't drop the rest of the batch.
        logger.error('WhatsApp inbound message processing failed', { error: err });
      }
    }

    // Meta doesn't read the response body, just the 2xx — anything else
    // (including delivery-status "statuses" payloads with no messages)
    // falls through to here with nothing to do.
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ received: true });
  }
}
