import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse } from '@/lib/domain/constants';
import { getProfessionalProfile } from '@/lib/domain/verification';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const profile = await getProfessionalProfile(id);

    if (!profile) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Professional not found'), { status: 404 });
    }

    return NextResponse.json(successResponse({ professional: profile }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
