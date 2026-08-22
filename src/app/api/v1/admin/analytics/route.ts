import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getApiUser, isAuthError } from '@/lib/api-auth';
import { successResponse, errorResponse } from '@/lib/domain/constants';

// Flat fields (totalCases, gmv, resolutionRate, ...) are what
// AdminOverview.tsx actually reads. They didn't exist here before — the
// route only ever returned the nested {users, cases, payments,
// professionals} shape below, so every one of those fields silently fell
// back to a hardcoded placeholder in the frontend (₦450,000 GMV, 48h avg
// resolution, "3" new cases today, shown regardless of real activity, even
// when this endpoint failed outright). Nested shape kept for anything else
// consuming it; flat fields are now real, computed values.
export async function GET(request: NextRequest) {
  try {
    const auth = await getApiUser(request, { requireRole: ['ADMIN'] });
    if (isAuthError(auth)) return auth.response;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalCustomers,
      totalProfessionals,
      totalCases,
      activeCases,
      resolvedCases,
      disputedCases,
      newCasesToday,
      totalPayments,
      totalRevenue,
      totalCommission,
      avgTrustScore,
      casesByStatus,
      casesByRiskLevel,
      resolvedCaseDates,
      casesWithQuote,
      totalQuotesSent,
      quotesAccepted,
      casesFunded,
      totalDisputesEverOpened,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { role: 'CUSTOMER' } }),
      db.professional.count(),
      db.case.count(),
      db.case.count({ where: { status: { notIn: ['RESOLVED', 'CANCELLED', 'DECLINED', 'REFUNDED'] } } }),
      db.case.count({ where: { status: 'RESOLVED' } }),
      db.case.count({ where: { status: 'DISPUTED' } }),
      db.case.count({ where: { createdAt: { gte: startOfToday } } }),
      db.payment.count({ where: { status: { in: ['SUCCESS', 'FUNDED', 'PAID_OUT'] } } }),
      db.payment.aggregate({ where: { status: { in: ['FUNDED', 'PAID_OUT'] } }, _sum: { grossAmount: true } }),
      db.payment.aggregate({ where: { status: { in: ['FUNDED', 'PAID_OUT'] } }, _sum: { commissionAmount: true } }),
      db.professional.aggregate({ _avg: { trustScore: true } }),
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
      db.case.findMany({ where: { status: 'RESOLVED', resolvedAt: { not: null } }, select: { createdAt: true, resolvedAt: true } }),
      db.case.count({ where: { quotes: { some: {} } } }),
      db.quote.count(),
      db.quote.count({ where: { status: 'ACCEPTED' } }),
      db.case.count({ where: { status: { in: ['FUNDED', 'IN_PROGRESS', 'PROOF', 'CUSTOMER_REVIEW', 'COMPLETED', 'RESOLVED'] } } }),
      db.dispute.count(),
    ]);

    // Average resolution time — createdAt to resolvedAt across RESOLVED
    // cases. Formatted as whole hours under 48h, otherwise whole days, to
    // match the "48h"-style unit the frontend already displays.
    let avgResolutionTime = '—';
    if (resolvedCaseDates.length > 0) {
      const avgMs =
        resolvedCaseDates.reduce((sum, c) => sum + (c.resolvedAt!.getTime() - c.createdAt.getTime()), 0) /
        resolvedCaseDates.length;
      const hours = avgMs / (1000 * 60 * 60);
      avgResolutionTime = hours < 48 ? `${Math.round(hours)}h` : `${Math.round(hours / 24)}d`;
    }

    const gmv = totalRevenue._sum.grossAmount || 0;
    const revenue = totalCommission._sum.commissionAmount || 0;
    const resolutionRate = totalCases > 0 ? Math.round((resolvedCases / totalCases) * 100) : 0;

    // Funnel conversion (PRD §22.2 KPI groups: Marketplace/Transactions/
    // Resolution). Each stage is "of the stage before it", not of total
    // cases, so a healthy funnel doesn't read as universally low.
    const funnel = {
      quoteRate: totalCases > 0 ? Math.round((casesWithQuote / totalCases) * 100) : 0,
      quoteAcceptanceRate: totalQuotesSent > 0 ? Math.round((quotesAccepted / totalQuotesSent) * 100) : 0,
      paymentConversionRate: quotesAccepted > 0 ? Math.round((casesFunded / quotesAccepted) * 100) : 0,
      disputeRate: casesFunded > 0 ? Math.round((totalDisputesEverOpened / casesFunded) * 100) : 0,
    };

    const analytics = {
      // Flat — read directly by AdminOverview.tsx
      totalCases,
      activeCases,
      gmv,
      revenue,
      resolutionRate,
      avgResolutionTime,
      disputedCases,
      newCasesToday,
      // Nested — kept for any other/future consumer
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
        totalRevenue: gmv,
        totalCommission: revenue,
      },
      professionals: {
        avgTrustScore: Math.round((avgTrustScore._avg.trustScore || 0) * 10) / 10,
      },
      funnel,
    };

    return NextResponse.json(successResponse(analytics));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
