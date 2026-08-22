// ============================================================
// REZZO Matching Engine
// ============================================================

import { db } from '@/lib/db';
import { CASE_EVENTS, ACTIVE_VERIFICATION_STATUSES, AVAILABILITY_STATUSES, MATCHING_WEIGHTS, VERIFICATION_TIER_BONUS, isVerificationActive } from './constants';
import { addCaseEvent } from './case-engine';

// ============ TYPES ============

export interface MatchResult {
  professionalId: string;
  userId: string;
  displayName: string | null;
  avatar: string | null;
  bio: string | null;
  trustScore: number;
  overallScore: number;
  skills: string[];
  serviceArea: string | null;
  matchExplanation: string;
  services: {
    id: string;
    name: string;
    pricingType: string;
    prices: { amount: number; currency: string; unit: string | null }[];
  }[];
}

export interface MatchingResult {
  caseId: string;
  matches: MatchResult[];
  totalProfessionalsScreened: number;
  matchedCount: number;
}

// ============ CATEGORY TO SKILL KEYWORD MAPPING ============

const CATEGORY_SKILL_MAP: Record<string, string[]> = {
  AC_REPAIR: ['ac repair', 'air conditioning', 'hvac', 'cooling', 'compressor', 'refrigerant'],
  GENERATOR_REPAIR: ['generator', 'gen set', 'power generator', 'diesel generator', 'inverter'],
  PLUMBING: ['plumbing', 'pipe fitting', 'drainage', 'water systems', 'bathroom fitting'],
  ELECTRICAL: ['electrical', 'wiring', 'electrical installation', 'power systems', 'circuit'],
  PROPERTY_HOUSING: ['property', 'housing', 'real estate', 'facilities management'],
  BUSINESS_ENTERPRISE: ['business consulting', 'compliance', 'registration', 'accounting'],
  GOVERNMENT_DOC: ['government documentation', 'document processing', 'verification'],
  GENERAL: [],
};

// ============ FIND MATCHES ============

export async function findMatches(caseId: string): Promise<MatchingResult> {
  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
  });

  if (!caseRecord) {
    throw new Error('Case not found');
  }

  // Extract category from routeJson
  const routeData = caseRecord.routeJson as Record<string, unknown> | null;
  const category = (routeData?.category as string) || 'GENERAL';
  const requiredExpertise = (routeData?.requiredExpertise as string[]) || [];
  const caseState = caseRecord.state || 'Lagos';
  const caseLocation = caseRecord.location || caseState;

  // Get skill keywords for this category
  const skillKeywords = CATEGORY_SKILL_MAP[category] || [];

  // Get all verified, active professionals with their skills and services
  const professionals = await db.professional.findMany({
    where: {
      verificationStatus: { in: [...ACTIVE_VERIFICATION_STATUSES] },
      availabilityStatus: AVAILABILITY_STATUSES.ACTIVE,
    },
    include: {
      user: { include: { profile: true } },
      skills: true,
      services: {
        where: { active: true },
        include: { prices: true },
      },
    },
  });

  // Score each professional
  const scored: (MatchResult & { _scoreBreakdown: Record<string, number> })[] = [];

  for (const pro of professionals) {
    let score = 0;
    const breakdown: Record<string, number> = {};

    // 1. Skill relevance (0-40 points)
    const proSkillNames = pro.skills.map((s) => s.name.toLowerCase());
    let skillMatchCount = 0;

    for (const keyword of skillKeywords) {
      if (proSkillNames.some((name) => name.includes(keyword) || keyword.includes(name))) {
        skillMatchCount++;
      }
    }

    // Also check required expertise
    for (const exp of requiredExpertise) {
      if (proSkillNames.some((name) => name.includes(exp.toLowerCase()) || exp.toLowerCase().includes(name))) {
        skillMatchCount++;
      }
    }

    const maxPossibleMatches = Math.max(skillKeywords.length + requiredExpertise.length, 1);
    const skillScore = Math.min(MATCHING_WEIGHTS.SKILL_RELEVANCE, (skillMatchCount / maxPossibleMatches) * MATCHING_WEIGHTS.SKILL_RELEVANCE);
    breakdown.skillRelevance = Math.round(skillScore * 10) / 10;
    score += skillScore;

    // Hard filter: if no skill match at all and we have keywords, skip
    if (skillMatchCount === 0 && (skillKeywords.length > 0 || requiredExpertise.length > 0)) {
      continue;
    }

    // 2. Trust score
    const trustScore = Math.min(MATCHING_WEIGHTS.TRUST_SCORE, (pro.trustScore / 100) * MATCHING_WEIGHTS.TRUST_SCORE);
    breakdown.trustScore = Math.round(trustScore * 10) / 10;
    score += trustScore;

    // 3. Location match
    let locationScore = 0;
    const proServiceArea = (pro.serviceArea || '').toLowerCase();
    const caseLoc = (caseLocation || '').toLowerCase();
    const caseSt = (caseState || '').toLowerCase();

    if (proServiceArea && (caseLoc.includes(proServiceArea) || proServiceArea.includes(caseLoc))) {
      locationScore = MATCHING_WEIGHTS.LOCATION_MATCH; // exact area match
    } else if (proServiceArea && (caseSt.includes(proServiceArea) || proServiceArea.includes(caseSt))) {
      locationScore = MATCHING_WEIGHTS.LOCATION_MATCH * 0.75; // same state
    } else {
      locationScore = MATCHING_WEIGHTS.LOCATION_MATCH * 0.25; // base score for being available
    }
    breakdown.locationMatch = Math.round(locationScore * 10) / 10;
    score += locationScore;

    // 4. Verification tier bonus
    const verificationBonus = VERIFICATION_TIER_BONUS[pro.verificationStatus] ?? 0;
    breakdown.verificationBonus = verificationBonus;
    score += verificationBonus;

    // Build explanation
    const explanationParts: string[] = [];
    if (breakdown.skillRelevance > 20) {
      const matchedSkills = pro.skills
        .filter((s) => skillKeywords.some((kw) => s.name.toLowerCase().includes(kw)))
        .map((s) => s.name);
      if (matchedSkills.length > 0) {
        explanationParts.push(`relevant expertise in ${matchedSkills.join(', ')}`);
      }
    }
    if (isVerificationActive(pro.verificationStatus)) {
      explanationParts.push('verified credentials');
    }
    if (breakdown.locationMatch >= 15) {
      explanationParts.push(`serves your area (${pro.serviceArea || caseState})`);
    }
    if (pro.trustScore >= 80) {
      explanationParts.push(`strong trust score (${Math.round(pro.trustScore)}%)`);
    }

    const matchExplanation = `Recommended because: ${explanationParts.join(', ')}.`;

    scored.push({
      professionalId: pro.id,
      userId: pro.userId,
      displayName: pro.user.profile?.displayName || null,
      avatar: pro.user.profile?.avatar || null,
      bio: pro.bio || null,
      trustScore: pro.trustScore,
      overallScore: Math.round(score * 10) / 10,
      skills: pro.skills.map((s) => s.name),
      serviceArea: pro.serviceArea,
      matchExplanation,
      services: pro.services.map((svc) => ({
        id: svc.id,
        name: svc.name,
        pricingType: svc.pricingType,
        prices: svc.prices.map((p) => ({
          amount: p.amount,
          currency: p.currency,
          unit: p.unit,
        })),
      })),
      _scoreBreakdown: breakdown,
    });
  }

  // Sort by overall score descending
  scored.sort((a, b) => b.overallScore - a.overallScore);

  // Remove the internal _scoreBreakdown before returning
  const matches: MatchResult[] = scored.map(({ _scoreBreakdown: _, ...rest }) => rest);

  // Add MATCHES_GENERATED event
  await addCaseEvent(
    caseId,
    CASE_EVENTS.MATCHES_GENERATED,
    'AI_SYSTEM',
    null,
    {
      totalScreened: professionals.length,
      matchedCount: matches.length,
      topScore: matches.length > 0 ? matches[0].overallScore : 0,
    }
  );

  return {
    caseId,
    matches,
    totalProfessionalsScreened: professionals.length,
    matchedCount: matches.length,
  };
}
