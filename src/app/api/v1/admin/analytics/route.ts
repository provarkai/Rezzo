import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';

export async function GET(request: NextRequest) {
  try {
    const auth = await getApiUser(request, { requireRole: ['ADMIN'] });
    if (isAuthError(auth)) return auth.response;

    // Gather analytics in parallel
    const [
      totalUsers,
      totalCustomers,
      totalProfessionals,
      totalCases,
      activeCases,
      resolvedCases,
      disputedCases,
      totalPayments,
      totalRevenue,
      totalCommission,
      avgTrustScore,
      casesByStatus,
      casesByRiskLevel,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { role: 'CUSTOMER' } }),
      db.professional.count(),
      db.case.count(),
      db.case.count({ where: { status: { notIn: ['RESOLVED', 'CANCELLED', 'DECLINED', 'REFUNDED'] } } }),
      db.case.count({ where: { status: 'RESOLVED' } }),
      db.case.count({ where: { status: 'DISPUTED' } }),
      db.payment.count({ where: { status: { in: ['SUCCESS', 'FUNDED', 'PAID_OUT'] } } }),
      db.payment.aggregate({ where: { status: { in: ['FUNDED', 'PAID_OUT'] } }, _sum: { grossAmount: true } }),
      db.payment.aggregate({ where: { status: { in: ['FUNDED', 'PAID_OUT'] } }, _sum: { commissionAmount: true } }),
      db.professional.aggregate({ _avg: { trustScore: true } }),
      // Status breakdown
      Promise.all(
        ['NEW', 'UNDERSTANDING', 'CLARIFICATION', 'CONFIRMATION', 'ROUTED', 'MATCHING', 'QUOTE', 'ACCEPTED', 'PAYMENT', 'FUNDED', 'IN_PROGRESS', 'PROOF', 'CUSTOMER_REVIEW', 'COMPLETED', 'RESOLVED', 'CANCELLED', 'DISPUTED'].map(
          async (status) => {
            const count = await db.case.count({ where: { status } });
            return { status, count };
          }
        )
      ),
      Promise.all(
        ['NORMAL', 'ELEVATED', 'HIGH'].map(
          async (riskLevel) => {
            const count = await db.case.count({ where: { riskLevel } });
            return { riskLevel, count };
          }
        )
      ),
    ]);

    const analytics = {
      users: {
        total: totalUsers,
        customers: totalCustomers,
        professionals: totalProfessionals,
      },
      cases: {
        total: totalCases,
        active: activeCases,
        resolved: resolvedCases,
        disputed: disputedCases,
        byStatus: casesByStatus,
        byRiskLevel: casesByRiskLevel,
      },
      payments: {
        completed: totalPayments,
        totalRevenue: totalRevenue._sum.grossAmount || 0,
        totalCommission: totalCommission._sum.commissionAmount || 0,
      },
      professionals: {
        avgTrustScore: Math.round((avgTrustScore._avg.trustScore || 0) * 10) / 10,
      },
    };

    return NextResponse.json(successResponse(analytics));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
