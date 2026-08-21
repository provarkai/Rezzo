import { NextRequest, NextResponse } from 'next/server';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { revokeDocumentShare } from '@/lib/domain/document-service';
import { z } from 'zod';

// The document id in the URL is mostly for a consistent /documents/[id]/*
// shape — a document can be shared with several cases, so the specific
// share to revoke is named by permissionId. revokeDocumentShare() itself
// re-checks that permission's document is owned by the caller regardless.
const revokeSchema = z.object({
  permissionId: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getApiUser(request);
    if (isAuthError(auth)) return auth.response;

    await params; // documentId not otherwise needed — revokeDocumentShare re-derives ownership
    const body = await request.json();
    const parsed = revokeSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(errorResponse('VALIDATION_ERROR', msg), { status: 400 });
    }

    const permission = await revokeDocumentShare(parsed.data.permissionId, auth.user.id);

    return NextResponse.json(successResponse({ permission }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('not found') ? 404 : message.includes('own') ? 403 : 500;
    return NextResponse.json(
      errorResponse(status === 404 ? 'NOT_FOUND' : status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR', message),
      { status }
    );
  }
}
