import { NextRequest, NextResponse } from 'next/server';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { shareDocumentWithCase } from '@/lib/domain/document-service';
import { notify } from '@/lib/domain/notification-service';
import { db } from '@/lib/db';
import { z } from 'zod';

const shareSchema = z.object({
  caseId: z.string().min(1),
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
    const parsed = shareSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(errorResponse('VALIDATION_ERROR', msg), { status: 400 });
    }

    const permission = await shareDocumentWithCase(id, auth.user.id, parsed.data.caseId);

    try {
      if (permission.recipientUserId) {
        const caseRecord = await db.case.findUnique({ where: { id: parsed.data.caseId }, select: { caseNumber: true } });
        await notify({
          userId: permission.recipientUserId,
          caseId: parsed.data.caseId,
          type: 'DOCUMENT_SHARED',
          title: `A document was shared — ${caseRecord?.caseNumber || ''}`,
          body: 'The customer shared a document from their Vault for this case.',
        });
      }
    } catch {
      // Notification is best-effort
    }

    return NextResponse.json(successResponse({ permission }), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('not found') ? 404 : message.includes('own') ? 403 : 500;
    return NextResponse.json(
      errorResponse(status === 404 ? 'NOT_FOUND' : status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR', message),
      { status }
    );
  }
}
