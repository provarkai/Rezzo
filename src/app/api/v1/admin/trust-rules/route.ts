import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse, MATCHING_WEIGHTS, VERIFICATION_TIER_BONUS } from '@/lib/domain/constants';

// Read-only: the actual live weights matching-engine.ts scores with (not a
// hand-copied duplicate — see MATCHING_WEIGHTS/VERIFICATION_TIER_BONUS in
// constants.ts), plus how professionals are actually distributed across
// them today. There's no runtime-editable "trust rules" store — changing
// the weights means changing the constants and shipping a build, same as
// COMMISSION_RATE.
export async function GET(request: NextRequest) {
  try {
    const auth = await getApiUser(request, { requireRole: ['ADMIN'] });
    if (isAuthError(auth)) return auth.response;

    const verificationCounts = await db.professional.groupBy({
      by: ['verificationStatus'],
      _count: { verificationStatus: true },
      _avg: { trustScore: true },
    });

    const distribution = verificationCounts.map((row) => ({
      verificationStatus: row.verificationStatus,
      count: row._count.verificationStatus,
      avgTrustScore: row._avg.trustScore ? Math.round(row._avg.trustScore * 10) / 10 : 0,
      matchingBonus: VERIFICATION_TIER_BONUS[row.verificationStatus] ?? 0,
    }));

    return NextResponse.json(successResponse({
      weights: MATCHING_WEIGHTS,
      verificationTierBonus: VERIFICATION_TIER_BONUS,
      distribution,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
