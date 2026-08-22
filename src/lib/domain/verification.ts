// ============================================================
// REZZO Verification Service
// ============================================================

import { db } from '@/lib/db';
import { uploadDocument } from './document-service';

// ============ TYPES ============

export interface ApplicationData {
  bio?: string;
  serviceArea?: string;
  skills: { name: string; level: string; categoryId?: string }[];
  services: {
    name: string;
    description?: string;
    pricingType: string;
    categoryId?: string;
    prices?: { amount: number; unit?: string }[];
  }[];
  credentials: {
    type: string;
    issuer?: string;
    reference?: string;
    // A supporting document — an ID photo, a certificate scan — is
    // optional per credential. When present it's uploaded through the
    // Vault's own uploadDocument() (document-service.ts) rather than a
    // separate storage path, and the resulting Document is what an admin
    // actually reviews in AdminProfessionalQueue, not just the type/issuer
    // text that was all reviewCredential() had to go on before.
    document?: { fileName: string; mimeType: string; dataBase64: string };
  }[];
}

export interface TrustScoreBreakdown {
  verificationScore: number;      // 0-30
  caseOutcomeScore: number;       // 0-30
  reviewScore: number;            // 0-25
  responseScore: number;          // 0-15
  total: number;                  // 0-100
}

// ============ SUBMIT PROFESSIONAL APPLICATION ============

export async function submitApplication(
  userId: string,
  applicationData: ApplicationData
) {
  // Create Professional record
  const professional = await db.professional.create({
    data: {
      userId,
      bio: applicationData.bio || null,
      serviceArea: applicationData.serviceArea || null,
      availabilityStatus: 'ACTIVE',
      trustScore: 0,
      verificationStatus: 'PENDING',
    },
  });

  // Create credentials — each one's supporting document, if attached, is
  // owned by the applicant's own userId (not the not-yet-fully-created
  // Professional record), matching how every other Vault document is owned.
  // A failed upload fails the whole application rather than silently
  // creating a credential with a missing document nobody would notice.
  for (const cred of applicationData.credentials) {
    let documentId: string | null = null;
    if (cred.document) {
      const doc = await uploadDocument(userId, {
        name: cred.document.fileName || `${cred.type} document`,
        type: 'CREDENTIAL',
        mimeType: cred.document.mimeType,
        dataBase64: cred.document.dataBase64,
      });
      documentId = doc.id;
    }
    await db.professionalCredential.create({
      data: {
        professionalId: professional.id,
        type: cred.type,
        issuer: cred.issuer || null,
        reference: cred.reference || null,
        documentId,
        status: 'PENDING',
      },
    });
  }

  // Create skills
  for (const skill of applicationData.skills) {
    await db.professionalSkill.create({
      data: {
        professionalId: professional.id,
        name: skill.name,
        level: skill.level || 'INTERMEDIATE',
        categoryId: skill.categoryId || null,
      },
    });
  }

  // Create services with prices
  for (const service of applicationData.services) {
    const svc = await db.service.create({
      data: {
        professionalId: professional.id,
        categoryId: service.categoryId || null,
        name: service.name,
        description: service.description || null,
        pricingType: service.pricingType || 'QUOTE_REQUIRED',
        active: true,
      },
    });

    // Create prices if provided
    if (service.prices && service.prices.length > 0) {
      for (const price of service.prices) {
        await db.servicePrice.create({
          data: {
            serviceId: svc.id,
            amount: price.amount,
            currency: 'NGN',
            unit: price.unit || 'flat',
          },
        });
      }
    }
  }

  // Update user role to PROFESSIONAL
  await db.user.update({
    where: { id: userId },
    data: { role: 'PROFESSIONAL' },
  });

  return professional;
}

// ============ REVIEW A SINGLE CREDENTIAL ============
//
// reviewVerification() below is a bulk, all-credentials-at-once decision —
// the only review path that existed until now, even though
// ProfessionalCredential already had its own per-row `status` column. This
// reviews one credential at a time and recomputes the professional's
// aggregate verificationStatus from the current state of all of them, so
// "verified" always reflects what was actually verified rather than one
// bulk click covering credentials nobody individually checked.

export async function reviewCredential(
  credentialId: string,
  reviewerId: string,
  status: 'VERIFIED' | 'REJECTED',
  notes?: string
) {
  const credential = await db.professionalCredential.findUnique({
    where: { id: credentialId },
  });
  if (!credential) throw new Error('Credential not found');

  await db.professionalCredential.update({
    where: { id: credentialId },
    data: { status },
  });

  const professionalId = credential.professionalId;

  // Reuses the professional-level VerificationReview log rather than adding
  // a credentialId column — the credential type is folded into the note so
  // the audit trail still says which one this decision was about.
  await db.verificationReview.create({
    data: {
      professionalId,
      reviewerId,
      status: status === 'VERIFIED' ? 'APPROVED' : 'REJECTED',
      notes: [`[${credential.type}]`, notes].filter(Boolean).join(' ') || null,
    },
  });

  const allCredentials = await db.professionalCredential.findMany({
    where: { professionalId },
  });
  const hasRejected = allCredentials.some((c) => c.status === 'REJECTED');
  const allVerified = allCredentials.length > 0 && allCredentials.every((c) => c.status === 'VERIFIED');

  let verificationStatus: string;
  let trustScore: number | undefined;

  if (allVerified) {
    trustScore = await calculateTrustScore(professionalId);
    verificationStatus = trustScore >= 90 ? 'EXPERT' : trustScore >= 75 ? 'TRUSTED' : 'VERIFIED';
  } else if (hasRejected) {
    // A rejected credential doesn't revoke the whole application (REVOKED
    // is reserved for reviewVerification's bulk rejection) — it sends the
    // applicant back to NEEDS_INFO so they know specifically what to fix.
    verificationStatus = 'NEEDS_INFO';
  } else {
    verificationStatus = 'PENDING';
  }

  return db.professional.update({
    where: { id: professionalId },
    data: trustScore !== undefined ? { verificationStatus, trustScore } : { verificationStatus },
    include: { credentials: true },
  });
}

// ============ REVIEW VERIFICATION ============

export async function reviewVerification(
  professionalId: string,
  reviewerId: string,
  status: string,
  notes?: string
) {
  const professional = await db.professional.findUnique({
    where: { id: professionalId },
    include: { credentials: true },
  });

  if (!professional) throw new Error('Professional not found');

  // Create verification review record
  await db.verificationReview.create({
    data: {
      professionalId,
      reviewerId,
      status,
      notes: notes || null,
    },
  });

  // Update all credential statuses based on review
  if (status === 'APPROVED') {
    await db.professionalCredential.updateMany({
      where: { professionalId },
      data: { status: 'VERIFIED' },
    });

    // Update professional verification status
    const trustScore = await calculateTrustScore(professionalId);
    const verificationStatus = trustScore >= 90 ? 'EXPERT' : trustScore >= 75 ? 'TRUSTED' : 'VERIFIED';

    await db.professional.update({
      where: { id: professionalId },
      data: {
        verificationStatus: verificationStatus,
        trustScore,
      },
    });
  } else if (status === 'REJECTED') {
    await db.professionalCredential.updateMany({
      where: { professionalId },
      data: { status: 'REJECTED' },
    });

    await db.professional.update({
      where: { id: professionalId },
      data: { verificationStatus: 'REVOKED' },
    });
  } else if (status === 'NEEDS_INFO') {
    await db.professional.update({
      where: { id: professionalId },
      data: { verificationStatus: 'NEEDS_INFO' },
    });
  }

  return db.professional.findUnique({ where: { id: professionalId } });
}

// ============ CALCULATE TRUST SCORE ============

export async function calculateTrustScore(
  professionalId: string
): Promise<number> {
  const professional = await db.professional.findUnique({
    where: { id: professionalId },
    include: {
      credentials: true,
      reviews: true,
      bookings: true,
    },
  });

  if (!professional) return 0;

  const breakdown = computeTrustBreakdown(professional);
  return Math.min(100, Math.max(0, Math.round(breakdown.total)));
}

function computeTrustBreakdown(professional: {
  credentials: { status: string }[];
  reviews: { rating: number }[];
  bookings: { status: string }[];
}): TrustScoreBreakdown {
  // 1. Verification score (0-30)
  const totalCreds = professional.credentials.length;
  const verifiedCreds = professional.credentials.filter(
    (c) => c.status === 'VERIFIED'
  ).length;
  const verificationScore =
    totalCreds > 0 ? (verifiedCreds / totalCreds) * 30 : 0;

  // 2. Case outcome score (0-30)
  const totalBookings = professional.bookings.length;
  const completedBookings = professional.bookings.filter(
    (b) => b.status === 'COMPLETED'
  ).length;
  const caseOutcomeScore =
    totalBookings > 0 ? (completedBookings / totalBookings) * 30 : 15; // Default 15 if no history

  // 3. Review score (0-25)
  const totalReviews = professional.reviews.length;
  const avgRating =
    totalReviews > 0
      ? professional.reviews.reduce((sum, r) => sum + r.rating, 0) /
        totalReviews
      : 0;
  const reviewScore = (avgRating / 5) * 25;

  // 4. Response score (0-15) - simplified for V1, use booking completion as proxy
  const responseScore =
    totalBookings > 0
      ? Math.min(15, (completedBookings / totalBookings) * 15 + 5)
      : 10; // Default 10 for new professionals

  const total = verificationScore + caseOutcomeScore + reviewScore + responseScore;

  return {
    verificationScore: Math.round(verificationScore * 10) / 10,
    caseOutcomeScore: Math.round(caseOutcomeScore * 10) / 10,
    reviewScore: Math.round(reviewScore * 10) / 10,
    responseScore: Math.round(responseScore * 10) / 10,
    total: Math.round(total * 10) / 10,
  };
}

// ============ GET PROFESSIONAL PROFILE ============

export async function getProfessionalProfile(professionalId: string) {
  return db.professional.findUnique({
    where: { id: professionalId },
    include: {
      user: {
        include: { profile: true },
      },
      credentials: true,
      skills: true,
      services: {
        where: { active: true },
        include: { prices: true },
      },
      reviews: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      _count: {
        select: {
          bookings: true,
          reviews: true,
          quotes: true,
        },
      },
    },
  });
}

// ============ LIST PROFESSIONALS ============

export async function listProfessionals(
  filters?: {
    verificationStatus?: string;
    serviceArea?: string;
    skill?: string;
    limit?: number;
    offset?: number;
  }
) {
  const limit = filters?.limit || 20;
  const offset = filters?.offset || 0;

  const where: Record<string, unknown> = {};

  if (filters?.verificationStatus) {
    where.verificationStatus = filters.verificationStatus;
  }
  if (filters?.serviceArea) {
    where.serviceArea = { contains: filters.serviceArea };
  }
  if (filters?.skill) {
    where.skills = {
      some: {
        name: { contains: filters.skill },
      },
    };
  }

  const [professionals, total] = await Promise.all([
    db.professional.findMany({
      where,
      include: {
        user: { include: { profile: true } },
        skills: true,
        services: {
          where: { active: true },
          include: { prices: true },
        },
        _count: {
          select: { reviews: true, bookings: true },
        },
      },
      orderBy: { trustScore: 'desc' },
      skip: offset,
      take: limit,
    }),
    db.professional.count({ where }),
  ]);

  return { professionals, total, limit, offset };
}
