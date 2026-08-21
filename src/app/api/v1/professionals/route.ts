import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { listProfessionals } from '@/lib/domain/verification';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const verificationStatus = searchParams.get('verificationStatus') || undefined;
    const serviceArea = searchParams.get('serviceArea') || undefined;
    const skill = searchParams.get('skill') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await listProfessionals({
      verificationStatus,
      serviceArea,
      skill,
      limit,
      offset,
    });

    return NextResponse.json(successResponse(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
