import { NextRequest, NextResponse } from 'next/server';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { orchestrateCase } from '@/lib/domain/ai-orchestrator';
import { getCaseWithDetails } from '@/lib/domain/case-engine';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getApiUser(request);
    if (isAuthError(auth)) return auth.response;

    const { id } = await params;

    const result = await orchestrateCase(id);

    // Return updated case details
    const caseDetails = await getCaseWithDetails(id);

    return NextResponse.json(successResponse({
      orchestration: result,
      case: caseDetails?.case,
      matter: caseDetails?.matter,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
