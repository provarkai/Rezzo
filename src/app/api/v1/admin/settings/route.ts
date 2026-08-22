import { NextRequest, NextResponse } from 'next/server';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse, COMMISSION_RATE, CURRENCY } from '@/lib/domain/constants';
import { isPaystackConfigured } from '@/lib/domain/payment-providers/paystack';
import { isWhatsAppConfigured } from '@/lib/domain/messaging-providers/whatsapp';

// Read-only. There's no Settings/Config table — the things V1 actually
// treats as configuration are environment variables and constants.ts, so
// this reports what's really in effect rather than pretending fields here
// are editable and silently doing nothing when saved.
export async function GET(request: NextRequest) {
  try {
    const auth = await getApiUser(request, { requireRole: ['ADMIN'] });
    if (isAuthError(auth)) return auth.response;

    return NextResponse.json(successResponse({
      commissionRate: COMMISSION_RATE,
      currency: CURRENCY,
      providers: {
        paystack: isPaystackConfigured(),
        whatsapp: isWhatsAppConfigured(),
      },
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
