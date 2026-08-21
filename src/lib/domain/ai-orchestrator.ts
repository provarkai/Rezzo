// ============================================================
// REZZO AI Orchestrator
// ============================================================

import { db } from '@/lib/db';
import {
  CASE_STATES,
  CASE_EVENTS,
  ROLES,
  RISK_LEVELS,
  AI_REZZO_SYSTEM_PROMPT,
  type CaseEventType,
} from './constants';
import { transitionCase, addCaseEvent, createMatterForCase } from './case-engine';

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

  // Government Documentation
  if (input.includes('passport') || input.includes('nin') || input.includes('national id') || input.includes('certificate') || input.includes('government') || input.includes('visa')) {
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
  try {
    // Dynamic import to avoid bundling on client
    const { llm } = await import('z-ai-web-dev-sdk');

    const response = await llm.chat({
      messages: [
        { role: 'system', content: AI_REZZO_SYSTEM_PROMPT },
        { role: 'user', content: rawInput },
      ],
      temperature: 0.3,
    });

    const content = typeof response === 'string' ? response : (response as Record<string, unknown>).content as string || JSON.stringify(response);

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
  } catch {
    // LLM call failed, fall through to mock
  }
  return null;
}

// ============ MAIN ORCHESTRATE FUNCTION ============

export async function orchestrateCase(caseId: string): Promise<AiOrchestrationResult> {
  // Get case with need
  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
    include: { need: true, matter: true, user: { include: { profile: true } } },
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

  // Create AI Job record
  const aiJob = await db.aiJob.create({
    data: {
      caseId,
      ownerId: caseRecord.userId,
      agentName: 'REZZO_ORCHESTRATOR',
      objective: `Classify and route case: ${caseRecord.caseNumber}`,
      risk: result.riskLevel,
      confidence: result.confidence / 100,
      status: 'COMPLETED',
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
    // High confidence, proceed to routing
    try {
      await transitionCase(
        caseId,
        CASE_STATES.ROUTED,
        'SYSTEM',
        ROLES.SYSTEM
      );
    } catch {
      // Already transitioning
    }
    // Then proceed to matching
    try {
      await transitionCase(
        caseId,
        CASE_STATES.MATCHING,
        'SYSTEM',
        ROLES.SYSTEM
      );
    } catch {
      // Already transitioning
    }
  }
}
