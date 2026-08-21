import { NextRequest, NextResponse } from 'next/server';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { getDocumentForViewer, deleteDocument } from '@/lib/domain/document-service';

// Returns the document including its content (storageKey — a data URI for
// V1's DB-backed storage). Owner, an admin, or the recipient of a live
// DocumentPermission may fetch it; everyone else gets 403.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getApiUser(request);
    if (isAuthError(auth)) return auth.response;

    const { id } = await params;

    const document = await getDocumentForViewer(id, auth.user.id, auth.user.role === 'ADMIN');

    return NextResponse.json(successResponse({ document }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message === 'Document not found' ? 404 : message.includes('access') ? 403 : 500;
    return NextResponse.json(
      errorResponse(status === 404 ? 'NOT_FOUND' : status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR', message),
      { status }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getApiUser(request);
    if (isAuthError(auth)) return auth.response;

    const { id } = await params;
    await deleteDocument(id, auth.user.id);

    return NextResponse.json(successResponse({ deleted: true }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message === 'Document not found' ? 404 : message.includes('own') ? 403 : 500;
    return NextResponse.json(
      errorResponse(status === 404 ? 'NOT_FOUND' : status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR', message),
      { status }
    );
  }
}
