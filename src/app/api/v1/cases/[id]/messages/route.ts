import { NextRequest, NextResponse } from 'next/server';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { sendMessage, getCaseMessages } from '@/lib/domain/case-engine';
import { z } from 'zod';

const messageSchema = z.object({
  body: z.string().min(1, 'Message body is required'),
  channel: z.enum(['APP', 'WHATSAPP', 'EMAIL']).default('APP'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getApiUser(request);
    if (isAuthError(auth)) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const parsed = messageSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(errorResponse('VALIDATION_ERROR', msg), { status: 400 });
    }

    const message = await sendMessage(id, auth.user.id, parsed.data.body, parsed.data.channel);

    return NextResponse.json(successResponse({ message }), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getApiUser(request);
    if (isAuthError(auth)) return auth.response;

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const result = await getCaseMessages(id, page, limit);

    return NextResponse.json(successResponse(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
