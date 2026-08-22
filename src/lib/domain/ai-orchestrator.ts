// ============================================================
// REZZO AI Orchestrator
// ============================================================

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  CASE_STATES,
  CASE_EVENTS,
  ROLES,
  RISK_LEVELS,
  AI_REZZO_SYSTEM_PROMPT,
  AI_ESCALATION_CONFIDENCE_THRESHOLD,
  AI_JOB_STATUSES,
  AI_MODEL,
  PUBLIC_USER_SELECT,
  type CaseEventType,
} from './constants';
import { transitionCase, addCaseEvent, createMatterForCase } from './case-engine';
import { detectHighRiskCategory } from './risk-detection';

// ============ TYPES ============

export interface AiOrchestrationResult {
  intent: string;
  need: string;
  matter: string;
  category: string;
  vertical: string;
  riskLevel: string;
  missingInformation: string[];
  route: string;
  requiredExpertise: string[];
  requiredDocuments: string[];
  nextAction: string;
  confidence: number;
  humanRequired: boolean;
}

// ============ MOCK AI FALLBACK (keyword matching) ============

function mockAiOrchestration(rawInput: string): AiOrchestrationResult {
  const input = rawInput.toLowerCase();

  // AC Repair
  if (input.includes('ac') || input.includes('air condition') || input.includes('cooling') || input.includes('fan') || input.includes('compressor')) {
    return {
      intent: 'Repair air conditioning system',
      need: 'AC Repair',
      matter: 'Air conditioning unit requires diagnosis and repair',
      category: 'AC_REPAIR',
      vertical: 'HOME_TECHNICAL',
      riskLevel: RISK_LEVELS.NORMAL,
      missingInformation: [],
      route: 'MATCH_TO_VERIFIED_PROFESSIONAL',
      requiredExpertise: ['AC repair', 'HVAC diagnostics', 'refrigerant handling'],
      requiredDocuments: [],
      nextAction: 'PROCEED_TO_MATCHING',
      confidence: 85,
      humanRequired: false,
    };
  }

  // Generator
  if (input.includes('generator') || input.includes('gen set') || input.includes('power')) {
    return {
      intent: 'Repair or diagnose generator',
      need: 'Generator Service',
      matter: 'Generator requires diagnosis, repair, or maintenance',
      category: 'GENERATOR_REPAIR',
      vertical: 'HOME_TECHNICAL',
      riskLevel: RISK_LEVELS.NORMAL,
      missingInformation: [],
      route: 'MATCH_TO_VERIFIED_PROFESSIONAL',
      requiredExpertise: ['generator repair', 'electrical systems', 'engine diagnostics'],
      requiredDocuments: [],
      nextAction: 'PROCEED_TO_MATCHING',
      confidence: 82,
      humanRequired: false,
    };
  }

  // Plumbing
  if (input.includes('plumb') || input.includes('pipe') || input.includes('water') || input.includes('leak') || input.includes('drain') || input.includes('toilet') || input.includes('bathroom')) {
    return {
      intent: 'Resolve plumbing issue',
      need: 'Plumbing Service',
      matter: 'Plumbing system requires repair or installation',
      category: 'PLUMBING',
      vertical: 'HOME_TECHNICAL',
      riskLevel: RISK_LEVELS.NORMAL,
      missingInformation: [],
      route: 'MATCH_TO_VERIFIED_PROFESSIONAL',
      requiredExpertise: ['plumbing', 'pipe fitting', 'drainage systems'],
      requiredDocuments: [],
      nextAction: 'PROCEED_TO_MATCHING',
      confidence: 80,
      humanRequired: false,
    };
  }

  // Electrical
  if (input.includes('electric') || input.includes('wiring') || input.includes('socket') || input.includes('switch') || input.includes('light') || input.includes('power outage')) {
    return {
      intent: 'Resolve electrical issue',
      need: 'Electrical Service',
      matter: 'Electrical system requires diagnosis and repair',
      category: 'ELECTRICAL',
      vertical: 'HOME_TECHNICAL',
      riskLevel: RISK_LEVELS.ELEVATED,
      missingInformation: [],
      route: 'MATCH_TO_VERIFIED_PROFESSIONAL',
      requiredExpertise: ['electrical repair', 'wiring', 'safety compliance'],
      requiredDocuments: [],
      nextAction: 'PROCEED_TO_MATCHING',
      confidence: 78,
      humanRequired: false,
    };
  }

  // Property / Housing
  if (input.includes('rent') || input.includes('house') || input.includes('landlord') || input.includes('tenant') || input.includes('property') || input.includes('eviction') || input.includes('lease')) {
    return {
      intent: 'Resolve property/housing matter',
      need: 'Property/Housing Service',
      matter: 'Property or housing related dispute or service needed',
      category: 'PROPERTY_HOUSING',
      vertical: 'PROPERTY_HOUSING',
      riskLevel: RISK_LEVELS.ELEVATED,
      missingInformation: ['Property address', 'Lease agreement details', 'Specific issue description'],
      route: 'REQUIRE_CLARIFICATION',
      requiredExpertise: ['property law', 'housing regulations', 'dispute resolution'],
      requiredDocuments: ['Lease agreement', 'Property documents', 'Correspondence'],
      nextAction: 'REQUEST_CLARIFICATION',
      confidence: 60,
      humanRequired: true,
    };
  }

  // Business
  if (input.includes('business') || input.includes('company') || input.includes('incorporation') || input.includes('tax') || input.includes('cac')) {
    return {
      intent: 'Business/enterprise service needed',
      need: 'Business Service',
      matter: 'Business registration, compliance, or enterprise service',
      category: 'BUSINESS_ENTERPRISE',
      vertical: 'BUSINESS_ENTERPRISE',
      riskLevel: RISK_LEVELS.NORMAL,
      missingInformation: ['Business name', 'Business type', 'Specific service needed'],
      route: 'REQUIRE_CLARIFICATION',
      requiredExpertise: ['business registration', 'compliance', 'CAC processes'],
      requiredDocuments: ['Business documents', 'Identification'],
      nextAction: 'REQUEST_CLARIFICATION',
      confidence: 55,
      humanRequired: true,
    };
  }

  // Government Documentation — sub-classified by document type, since the
  // checklist and source hierarchy (PRD §12.2/12.3) differ a lot between
  // them. Falls through to a generic branch for anything else that reads
  // as government-related but doesn't name a specific document.
  if (input.includes('passport')) {
    return {
      intent: 'Passport application or renewal',
      need: 'Passport Processing',
      matter: 'Nigerian passport application or renewal assistance',
      category: 'PASSPORT',
      vertical: 'GOVERNMENT_DOCUMENTATION',
      riskLevel: RISK_LEVELS.ELEVATED,
      missingInformation: ['New application or renewal', 'Current passport status', 'Preferred passport office'],
      route: 'REQUIRE_CLARIFICATION',
      requiredExpertise: ['government documentation', 'passport processes'],
      requiredDocuments: ['Valid means of ID (NIN slip, voter\'s card, or old passport)', 'Birth certificate or age declaration', 'Passport photographs (white background)', 'Local government/parent attestation (first-time applicants)'],
      nextAction: 'REQUEST_CLARIFICATION',
      confidence: 55,
      humanRequired: true,
    };
  }

  if (input.includes('nin') || input.includes('national id')) {
    return {
      intent: 'National Identification Number (NIN) assistance',
      need: 'NIN Registration',
      matter: 'NIN enrollment, retrieval, or record correction',
      category: 'NIN',
      vertical: 'GOVERNMENT_DOCUMENTATION',
      riskLevel: RISK_LEVELS.ELEVATED,
      missingInformation: ['New enrollment, retrieval, or correction', 'Nearest NIMC enrollment center'],
      route: 'REQUIRE_CLARIFICATION',
      requiredExpertise: ['government documentation', 'NIMC processes'],
      requiredDocuments: ['Birth certificate or age declaration', 'Proof of address', 'Existing ID document (if correcting a record)'],
      nextAction: 'REQUEST_CLARIFICATION',
      confidence: 55,
      humanRequired: true,
    };
  }

  if (input.includes('birth certificate') || input.includes('birth cert')) {
    return {
      intent: 'Birth certificate registration or retrieval',
      need: 'Birth Certificate',
      matter: 'Birth registration or certificate reissuance',
      category: 'BIRTH_CERTIFICATE',
      vertical: 'GOVERNMENT_DOCUMENTATION',
      riskLevel: RISK_LEVELS.ELEVATED,
      missingInformation: ['Registering a new birth or retrieving an existing certificate', 'State of birth'],
      route: 'REQUIRE_CLARIFICATION',
      requiredExpertise: ['government documentation', 'vital registration processes'],
      requiredDocuments: ['Hospital birth notification (for new registration)', 'Parents\' means of ID', 'Marriage certificate (if applicable)'],
      nextAction: 'REQUEST_CLARIFICATION',
      confidence: 55,
      humanRequired: true,
    };
  }

  if (input.includes('driver') || input.includes('drivers licence') || input.includes('driving licence') || input.includes('driving license')) {
    return {
      intent: "Driver's licence application or renewal",
      need: "Driver's Licence",
      matter: "Driver's licence application, renewal, or replacement",
      category: 'DRIVERS_LICENSE',
      vertical: 'GOVERNMENT_DOCUMENTATION',
      riskLevel: RISK_LEVELS.ELEVATED,
      missingInformation: ['New application, renewal, or replacement', 'State of issuance'],
      route: 'REQUIRE_CLARIFICATION',
      requiredExpertise: ['government documentation', 'FRSC processes'],
      requiredDocuments: ['NIN slip', 'Proof of address', 'Eye test report', 'Old licence (for renewal/replacement)'],
      nextAction: 'REQUEST_CLARIFICATION',
      confidence: 55,
      humanRequired: true,
    };
  }

  if (input.includes('certificate') || input.includes('government') || input.includes('visa')) {
    return {
      intent: 'Government documentation assistance',
      need: 'Government Documentation',
      matter: 'Government document processing or verification',
      category: 'GOVERNMENT_DOC',
      vertical: 'GOVERNMENT_DOCUMENTATION',
      riskLevel: RISK_LEVELS.ELEVATED,
      missingInformation: ['Document type', 'Current status', 'Urgency'],
      route: 'REQUIRE_CLARIFICATION',
      requiredExpertise: ['government documentation', 'document verification'],
      requiredDocuments: ['Identification documents', 'Supporting documents'],
      nextAction: 'REQUEST_CLARIFICATION',
      confidence: 50,
      humanRequired: true,
    };
  }

  // Default fallback
  return {
    intent: 'General service request',
    need: 'General Service',
    matter: 'Customer has a general service request that needs classification',
    category: 'GENERAL',
    vertical: 'HOME_TECHNICAL',
    riskLevel: RISK_LEVELS.NORMAL,
    missingInformation: ['Specific service category', 'Detailed description of the issue', 'Location'],
    route: 'REQUIRE_CLARIFICATION',
    requiredExpertise: [],
    requiredDocuments: [],
    nextAction: 'REQUEST_CLARIFICATION',
    confidence: 30,
    humanRequired: true,
  };
}

// ============ AI ORCHESTRATION WITH LLM ============

async function callLlmOrchestration(rawInput: string): Promise<AiOrchestrationResult | null> {
  // No key configured (local dev without one, or the var simply unset) —
  // skip straight to the mock rather than letting the SDK throw on an
  // empty/missing credential.
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    // Dynamic import to avoid bundling on client
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic();

    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 4096,
      system: AI_REZZO_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: rawInput }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const content = textBlock?.text ?? '';

    // Try to parse JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        intent: parsed.intent || 'Unknown',
        need: parsed.need || 'General',
        matter: parsed.matter || '',
        category: parsed.category || 'GENERAL',
        vertical: parsed.vertical || 'HOME_TECHNICAL',
        riskLevel: parsed.riskLevel || RISK_LEVELS.NORMAL,
        missingInformation: Array.isArray(parsed.missingInformation) ? parsed.missingInformation : [],
        route: parsed.route || 'REQUIRE_CLARIFICATION',
        requiredExpertise: Array.isArray(parsed.requiredExpertise) ? parsed.requiredExpertise : [],
        requiredDocuments: Array.isArray(parsed.requiredDocuments) ? parsed.requiredDocuments : [],
        nextAction: parsed.nextAction || 'REQUEST_CLARIFICATION',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 50,
        humanRequired: !!parsed.humanRequired,
      };
    }
  } catch (err) {
    // LLM call failed (bad key, rate limit, network) — fall through to the
    // mock rather than failing case intake outright. Logged so a silently
    // misconfigured key doesn't look like the mock working as intended.
    logger.warn('Claude orchestration call failed, falling back to mock', { error: err });
  }
  return null;
}

// ============ MAIN ORCHESTRATE FUNCTION ============

export async function orchestrateCase(caseId: string): Promise<AiOrchestrationResult> {
  // Get case with need
  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
    include: { need: true, matter: true, user: { select: PUBLIC_USER_SELECT } },
  });

  if (!caseRecord || !caseRecord.need) {
    throw new Error('Case or need not found');
  }

  const rawInput = caseRecord.need.rawInput;

  // Try LLM first, fall back to mock
  let result: AiOrchestrationResult | null = null;
  try {
    result = await callLlmOrchestration(rawInput);
  } catch {
    result = null;
  }

  if (!result) {
    result = mockAiOrchestration(rawInput);
  }

  // §16.2 high-risk safety net — overrides whatever the classifier decided,
  // mock or LLM. Applied here rather than inside either classifier so it
  // can't be bypassed by a future prompt change or a new mock branch.
  const highRiskCategory = detectHighRiskCategory(rawInput);
  if (highRiskCategory) {
    result = { ...result, riskLevel: RISK_LEVELS.HIGH, humanRequired: true };
  }

  // §16.1 "human escalation thresholds" — low confidence, an explicit
  // humanRequired flag, or a detected high-risk category all mean a human
  // reviews this job before it's considered COMPLETED. Previously this
  // status was hardcoded to COMPLETED regardless, so ESCALATED (a value
  // the schema already had a column for) never actually got used.
  const needsEscalation =
    result.humanRequired ||
    result.confidence < AI_ESCALATION_CONFIDENCE_THRESHOLD ||
    result.riskLevel === RISK_LEVELS.HIGH;

  // Create AI Job record
  const aiJob = await db.aiJob.create({
    data: {
      caseId,
      ownerId: caseRecord.userId,
      agentName: 'REZZO_ORCHESTRATOR',
      objective: `Classify and route case: ${caseRecord.caseNumber}`,
      risk: result.riskLevel,
      confidence: result.confidence / 100,
      status: needsEscalation ? AI_JOB_STATUSES.ESCALATED : AI_JOB_STATUSES.COMPLETED,
      highRiskCategory,
      outputJson: result as object,
    },
  });

  // Add AI understanding event
  await addCaseEvent(
    caseId,
    CASE_EVENTS.AI_UNDERSTANDING as CaseEventType,
    'AI_SYSTEM',
    null,
    {
      aiJobId: aiJob.id,
      intent: result.intent,
      category: result.category,
      confidence: result.confidence,
      riskLevel: result.riskLevel,
      humanRequired: result.humanRequired,
      highRiskCategory,
      escalated: needsEscalation,
    }
  );

  // Handle the orchestration result
  await handleOrchestrationResult(caseId, result);

  return result;
}

// ============ HANDLE ORCHESTRATION RESULT ============

export async function handleOrchestrationResult(
  caseId: string,
  result: AiOrchestrationResult
) {
  // Transition to UNDERSTANDING
  try {
    await transitionCase(
      caseId,
      CASE_STATES.UNDERSTANDING,
      'SYSTEM',
      ROLES.SYSTEM
    );
  } catch {
    // May already be in UNDERSTANDING, that's fine
  }

  // Create or update Matter
  await createMatterForCase(caseId, {
    summary: result.matter,
    categoryId: result.category,
    urgency: result.riskLevel === 'HIGH' ? 'URGENT' : result.riskLevel === 'ELEVATED' ? 'HIGH' : 'NORMAL',
    confidence: result.confidence / 100,
    requiredDocuments: result.requiredDocuments,
  });

  // Update case with AI results
  await db.case.update({
    where: { id: caseId },
    data: {
      riskLevel: result.riskLevel,
      routeJson: {
        route: result.route,
        category: result.category,
        vertical: result.vertical,
        requiredExpertise: result.requiredExpertise,
        requiredDocuments: result.requiredDocuments,
      },
    },
  });

  // Determine next state based on AI result
  if (result.humanRequired || result.confidence < 60) {
    // Need clarification
    try {
      await transitionCase(
        caseId,
        CASE_STATES.CLARIFICATION,
        'SYSTEM',
        ROLES.SYSTEM
      );
    } catch {
      // Already transitioning
    }
  } else {
    // High confidence — show the customer what AI REZZO understood and wait
    // for them to confirm or correct it before routing/matching (design
    // spec §9: "Here's what I understand. Is this correct?").
    try {
      await transitionCase(
        caseId,
        CASE_STATES.CONFIRMATION,
        'SYSTEM',
        ROLES.SYSTEM
      );
    } catch {
      // Already transitioning
    }
  }
}
