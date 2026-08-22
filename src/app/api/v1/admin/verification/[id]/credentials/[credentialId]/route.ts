import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { reviewCredential } from '@/lib/domain/verification';
import { logAdminAction } from '@/lib/domain/audit-service';
import { z } from 'zod';

const reviewSchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED']),
  notes: z.string().optional(),
});

// Per-credential counterpart to POST /admin/verification/[id] (which
// approves/rejects everything on an application in one bulk decision).
// [id] here is the Professional id, kept in the path for scoping even
// though the review itself only needs [credentialId] — it also guards
// against passing a credential that belongs to a different professional.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; credentialId: string }> }
) {
  try {
    const auth = await getApiUser(request, { requireRole: ['ADMIN'] });
    if (isAuthError(auth)) return auth.response;

    const { id, credentialId } = await params;
    const body = await request.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(errorResponse('VALIDATION_ERROR', msg), { status: 400 });
    }

    const credential = await db.professionalCredential.findUnique({ where: { id: credentialId } });
    if (!credential || credential.professionalId !== id) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Credential not found on this professional'), { status: 404 });
    }

    const professional = await reviewCredential(credentialId, auth.user.id, parsed.data.status, parsed.data.notes);

    await logAdminAction({
      actorId: auth.user.id,
      action: `CREDENTIAL_${parsed.data.status}`,
      resourceType: 'ProfessionalCredential',
      resourceId: credentialId,
      metadata: { professionalId: id, credentialType: credential.type, notes: parsed.data.notes || null },
    });

    return NextResponse.json(successResponse({ professional }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
