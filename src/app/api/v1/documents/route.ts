import { NextRequest, NextResponse } from 'next/server';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { uploadDocument, listUserDocuments } from '@/lib/domain/document-service';
import { z } from 'zod';

const uploadSchema = z.object({
  name: z.string().min(1, 'A file name is required'),
  type: z.enum(['IDENTITY', 'PROPERTY', 'GOVERNMENT', 'BUSINESS', 'OTHER']),
  mimeType: z.string().min(1),
  dataBase64: z.string().min(1, 'File data is required'),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await getApiUser(request);
    if (isAuthError(auth)) return auth.response;

    const documents = await listUserDocuments(auth.user.id);

    return NextResponse.json(successResponse({ documents }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getApiUser(request);
    if (isAuthError(auth)) return auth.response;

    const body = await request.json();
    const parsed = uploadSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(errorResponse('VALIDATION_ERROR', msg), { status: 400 });
    }

    const document = await uploadDocument(auth.user.id, parsed.data);

    return NextResponse.json(successResponse({ document }), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('too large') || message.includes('empty') ? 400 : 500;
    return NextResponse.json(errorResponse(status === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR', message), { status });
  }
}
