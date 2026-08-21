// ============================================================
// REZZO Case Engine
// ============================================================

import { db } from '@/lib/db';
import {
  CASE_STATES,
  CASE_EVENTS,
  ROLES,
  isValidTransition,
  generateCaseNumber,
  FOLLOWUP_TRIGGER_TYPES,
  FOLLOWUP_STATUSES,
  PROTECTION_BENEFIT_TYPES,
  PROTECTION_BENEFIT_STATUSES,
  type CaseState,
  type CaseEventType,
} from './constants';
import { scanMessageForBypassSignals } from './bypass-detection';

// ============ TYPES ============

export interface CreateCaseInput {
  title: string;
  rawInput: string;
  desiredOutcome?: string;
  location?: string;
  state?: string;
  priority?: string;
}

export interface CaseDetails {
  case: Record<string, unknown>;
  need: Record<string, unknown> | null;
  matter: Record<string, unknown> | null;
  events: Record<string, unknown>[];
  participants: Record<string, unknown>[];
  quotes: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  bookings: Record<string, unknown>[];
  proofItems: Record<string, unknown>[];
  messages: Record<string, unknown>[];
  disputes: Record<string, unknown>[];
  reviews: Record<string, unknown>[];
}

// ============ CREATE CASE ============

export async function createCase(
  userId: string,
  input: CreateCaseInput
) {
  // Count existing cases for case number generation
  const caseCount = await db.case.count();
  const caseNumber = generateCaseNumber(caseCount);

  // Create the Need
  const need = await db.need.create({
    data: {
      userId,
      title: input.title,
      rawInput: input.rawInput,
      desiredOutcome: input.desiredOutcome || null,
    },
  });

  // Create the Case
  const caseRecord = await db.case.create({
    data: {
      caseNumber,
      userId,
      needId: need.id,
      status: CASE_STATES.NEW,
      location: input.location || null,
      state: input.state || null,
      priority: input.priority || 'NORMAL',
      routeJson: null,
      resolutionCriteria: null,
    },
  });

  // Add customer as participant
  await db.caseParticipant.create({
    data: {
      caseId: caseRecord.id,
      userId,
      role: ROLES.CUSTOMER,
      permissions: {
        canView: true,
        canMessage: true,
        canAcceptQuote: true,
        canDispute: true,
        canReview: true,
      },
    },
  });

  // Add CASE_CREATED event
  await addCaseEvent(
    caseRecord.id,
    CASE_EVENTS.CASE_CREATED,
    ROLES.CUSTOMER,
    userId,
    {
      title: input.title,
      caseNumber,
      rawInput: input.rawInput,
    }
  );

  return caseRecord;
}

// ============ TRANSITION CASE ============

export async function transitionCase(
  caseId: string,
  newState: CaseState,
  actorId: string,
  actorType: string = ROLES.CUSTOMER
) {
  const caseRecord = await db.case.findUnique({ where: { id: caseId } });
  if (!caseRecord) {
    throw new Error('Case not found');
  }

  const currentState = caseRecord.status as CaseState;

  if (!isValidTransition(currentState, newState)) {
    throw new Error(
      `Invalid transition from ${currentState} to ${newState}`
    );
  }

  const updated = await db.case.update({
    where: { id: caseId },
    data: {
      status: newState,
      ...(newState === CASE_STATES.RESOLVED
        ? { resolvedAt: new Date() }
        : {}),
    },
  });

  // Map state transitions to events
  const eventMap: Partial<Record<CaseState, CaseEventType>> = {
    UNDERSTANDING: CASE_EVENTS.AI_UNDERSTANDING,
    CLARIFICATION: CASE_EVENTS.CLARIFICATION_REQUESTED,
    CONFIRMATION: CASE_EVENTS.AI_UNDERSTANDING_READY,
    ROUTED: CASE_EVENTS.ROUTE_SELECTED,
    MATCHING: CASE_EVENTS.MATCHES_GENERATED,
    QUOTE: CASE_EVENTS.QUOTE_RECEIVED,
    ACCEPTED: CASE_EVENTS.QUOTE_ACCEPTED,
    PAYMENT: CASE_EVENTS.PAYMENT_INITIATED,
    FUNDED: CASE_EVENTS.PAYMENT_CONFIRMED,
    IN_PROGRESS: CASE_EVENTS.SERVICE_STARTED,
    PROOF: CASE_EVENTS.PROOF_SUBMITTED,
    CUSTOMER_REVIEW: CASE_EVENTS.CUSTOMER_APPROVED,
    COMPLETED: CASE_EVENTS.CASE_COMPLETED,
    RESOLVED: CASE_EVENTS.CASE_RESOLVED,
    DISPUTED: CASE_EVENTS.DISPUTE_OPENED,
    ESCALATED: CASE_EVENTS.ESCALATED,
    CANCELLED: CASE_EVENTS.CASE_CANCELLED,
  };

  const eventType = eventMap[newState];
  if (eventType) {
    await addCaseEvent(caseId, eventType, actorType, actorId, {
      from: currentState,
      to: newState,
    });
  }

  if (newState === CASE_STATES.RESOLVED) {
    await scheduleFollowUp(caseId, updated.routeJson);
  }

  return updated;
}

// ============ CONFIRM AI UNDERSTANDING ============

/**
 * The customer's response to "Here's what I understand — is this correct?"
 * (design spec §9). Confirming chains the case through ROUTED → MATCHING;
 * correcting sends it back through UNDERSTANDING with the correction folded
 * into the Need so AI REZZO re-processes it. Re-running the AI itself is the
 * caller's job (case-engine doesn't import the AI orchestrator, to avoid a
 * circular import — see POST /cases/[id]/confirm-understanding).
 */
export async function confirmUnderstanding(
  caseId: string,
  customerId: string,
  confirmed: boolean,
  correction?: string
) {
  const caseRecord = await db.case.findUnique({ where: { id: caseId }, include: { need: true } });
  if (!caseRecord) throw new Error('Case not found');

  if (confirmed) {
    // transitionCase logs ROUTE_SELECTED/MATCHES_GENERATED itself via its
    // event map, so there's nothing further to log here.
    for (const state of [CASE_STATES.ROUTED, CASE_STATES.MATCHING] as CaseState[]) {
      try {
        await transitionCase(caseId, state, customerId, ROLES.CUSTOMER);
      } catch {
        // Already past this state
      }
    }
    return db.case.findUnique({ where: { id: caseId } });
  }

  await transitionCase(caseId, CASE_STATES.UNDERSTANDING, customerId, ROLES.CUSTOMER);

  if (correction?.trim() && caseRecord.needId) {
    await db.need.update({
      where: { id: caseRecord.needId },
      data: {
        rawInput: `${caseRecord.need?.rawInput || ''}\n\nCustomer correction: ${correction.trim()}`,
      },
    });
  }

  return db.case.findUnique({ where: { id: caseId } });
}

// ============ CASE CONTINUITY: FOLLOW-UP SCHEDULING ============

// PRD Upgrade §11 "Case Continuity": what a resolved case's vertical
// suggests as the next relevant action, and roughly how soon it's worth
// surfacing. These are V1 defaults, not policy — tune once real usage data
// exists.
const VERTICAL_FOLLOWUP_TYPE: Record<string, string> = {
  HOME_TECHNICAL: FOLLOWUP_TRIGGER_TYPES.MAINTENANCE_REMINDER,
  PROPERTY_HOUSING: FOLLOWUP_TRIGGER_TYPES.DOCUMENTATION_ROUTE,
  BUSINESS_ENTERPRISE: FOLLOWUP_TRIGGER_TYPES.TAX_COMPLIANCE_ROUTE,
};

const FOLLOWUP_DUE_DAYS: Record<string, number> = {
  [FOLLOWUP_TRIGGER_TYPES.MAINTENANCE_REMINDER]: 90,
  [FOLLOWUP_TRIGGER_TYPES.DOCUMENTATION_ROUTE]: 30,
  [FOLLOWUP_TRIGGER_TYPES.TAX_COMPLIANCE_ROUTE]: 30,
  [FOLLOWUP_TRIGGER_TYPES.REPEAT_SERVICE]: 180,
};

/**
 * Schedule the resolved case's next-need follow-up (§11) and, if the case
 * was protected, flip its FOLLOW_UP ProtectionBenefit to ACTIVE. Idempotent
 * per case: skips if a pending/sent follow-up already exists, so a case
 * that gets disputed and re-resolved doesn't pile up duplicates.
 */
export async function scheduleFollowUp(caseId: string, routeJson: unknown) {
  const existing = await db.followUp.findFirst({
    where: { caseId, status: { in: [FOLLOWUP_STATUSES.PENDING, FOLLOWUP_STATUSES.SENT] } },
  });
  if (existing) return existing;

  const vertical = ((routeJson as Record<string, unknown> | null)?.vertical as string) || '';
  const triggerType = VERTICAL_FOLLOWUP_TYPE[vertical] || FOLLOWUP_TRIGGER_TYPES.REPEAT_SERVICE;
  const dueInDays = FOLLOWUP_DUE_DAYS[triggerType] ?? 180;
  const dueAt = new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000);

  const followUp = await db.followUp.create({
    data: { caseId, triggerType, dueAt, status: FOLLOWUP_STATUSES.PENDING },
  });

  await db.protectionBenefit.upsert({
    where: { caseId_benefitType: { caseId, benefitType: PROTECTION_BENEFIT_TYPES.FOLLOW_UP } },
    update: { eligible: true, status: PROTECTION_BENEFIT_STATUSES.ACTIVE },
    create: {
      caseId,
      benefitType: PROTECTION_BENEFIT_TYPES.FOLLOW_UP,
      eligible: true,
      status: PROTECTION_BENEFIT_STATUSES.ACTIVE,
    },
  });

  return followUp;
}

// ============ ADD CASE EVENT ============

export async function addCaseEvent(
  caseId: string,
  eventType: CaseEventType,
  actorType: string,
  actorId: string | null,
  payload?: Record<string, unknown>
) {
  return db.caseEvent.create({
    data: {
      caseId,
      eventType,
      actorType,
      actorId: actorId || null,
      payload: payload ? (payload as object) : null,
    },
  });
}

// ============ GET CASE WITH FULL DETAILS ============

export async function getCaseWithDetails(caseId: string): Promise<CaseDetails | null> {
  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
    include: {
      need: true,
      matter: true,
      events: {
        orderBy: { createdAt: 'asc' },
      },
      participants: {
        include: {
          user: {
            include: { profile: true, professional: true },
          },
        },
      },
      quotes: {
        include: {
          professional: {
            include: { user: { include: { profile: true } } },
          },
          service: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      payments: {
        orderBy: { createdAt: 'desc' },
      },
      bookings: {
        orderBy: { createdAt: 'desc' },
      },
      messages: {
        include: {
          sender: {
            include: { profile: true, professional: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      disputes: {
        orderBy: { createdAt: 'desc' },
      },
      reviews: {
        orderBy: { createdAt: 'desc' },
      },
      proofItems: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!caseRecord) return null;

  return {
    case: caseRecord as unknown as Record<string, unknown>,
    need: caseRecord.need
      ? (caseRecord.need as unknown as Record<string, unknown>)
      : null,
    matter: caseRecord.matter
      ? (caseRecord.matter as unknown as Record<string, unknown>)
      : null,
    events: caseRecord.events as unknown as Record<string, unknown>[],
    participants: caseRecord.participants as unknown as Record<string, unknown>[],
    quotes: caseRecord.quotes as unknown as Record<string, unknown>[],
    payments: caseRecord.payments as unknown as Record<string, unknown>[],
    bookings: caseRecord.bookings as unknown as Record<string, unknown>[],
    // Also nested under `case.proofItems` (caseRecord is spread in as-is above),
    // but exposed here too since that's the top-level key existing UI code reads.
    proofItems: caseRecord.proofItems as unknown as Record<string, unknown>[],
    messages: caseRecord.messages as unknown as Record<string, unknown>[],
    disputes: caseRecord.disputes as unknown as Record<string, unknown>[],
    reviews: caseRecord.reviews as unknown as Record<string, unknown>[],
  };
}

// ============ CREATE MATTER FOR CASE ============

export async function createMatterForCase(
  caseId: string,
  data: {
    summary?: string;
    categoryId?: string;
    urgency?: string;
    confidence?: number;
  }
) {
  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
    include: { need: true, matter: true },
  });
  if (!caseRecord || !caseRecord.needId) {
    throw new Error('Case or need not found');
  }

  // If matter already exists, update it instead
  if (caseRecord.matter) {
    return db.matter.update({
      where: { id: caseRecord.matter.id },
      data: {
        summary: data.summary ?? caseRecord.matter.summary,
        categoryId: data.categoryId ?? caseRecord.matter.categoryId,
        urgency: data.urgency ?? caseRecord.matter.urgency,
        confidence: data.confidence ?? caseRecord.matter.confidence,
      },
    });
  }

  const matter = await db.matter.create({
    data: {
      needId: caseRecord.needId,
      summary: data.summary || null,
      categoryId: data.categoryId || null,
      urgency: data.urgency || 'NORMAL',
      confidence: data.confidence || 0,
    },
  });

  await db.case.update({
    where: { id: caseId },
    data: { matterId: matter.id },
  });

  return matter;
}

// ============ LIST USER CASES ============

export async function listUserCases(userId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  // Get cases where user is owner OR participant
  const [cases, total] = await Promise.all([
    db.case.findMany({
      where: {
        OR: [
          { userId },
          { participants: { some: { userId } } },
        ],
      },
      include: {
        need: true,
        matter: true,
        user: { include: { profile: true } },
        participants: { include: { user: { include: { profile: true } } } },
        _count: {
          select: {
            events: true,
            quotes: true,
            messages: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.case.count({
      where: {
        OR: [
          { userId },
          { participants: { some: { userId } } },
        ],
      },
    }),
  ]);

  return {
    cases,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ============ ADD PARTICIPANT TO CASE ============

export async function addParticipant(
  caseId: string,
  userId: string,
  role: string,
  permissions: Record<string, unknown> = {}
) {
  const existing = await db.caseParticipant.findUnique({
    where: {
      caseId_userId: { caseId, userId },
    },
  });

  if (existing) {
    return existing;
  }

  return db.caseParticipant.create({
    data: {
      caseId,
      userId,
      role,
      permissions: {
        canView: true,
        canMessage: true,
        ...permissions,
      },
    },
  });
}

// ============ SEND MESSAGE ============

export async function sendMessage(
  caseId: string,
  senderId: string,
  body: string,
  channel: string = 'APP'
) {
  const caseRecord = await db.case.findUnique({ where: { id: caseId } });
  if (!caseRecord) {
    throw new Error('Case not found');
  }

  const message = await db.message.create({
    data: {
      caseId,
      senderId,
      body,
      channel,
      attachmentsJson: [],
    },
  });

  // Anti-bypass detection (PRD Upgrade §6-§7) — never let it block message
  // delivery if something about the scan itself fails.
  try {
    const sender = await db.user.findUnique({ where: { id: senderId }, select: { role: true } });
    await scanMessageForBypassSignals({
      caseId,
      messageId: message.id,
      senderId,
      senderRole: sender?.role || ROLES.CUSTOMER,
      channel,
      body,
    });
  } catch {
    // Detection is best-effort; the message itself has already been sent.
  }

  return message;
}

// ============ GET CASE MESSAGES ============

export async function getCaseMessages(caseId: string, page = 1, limit = 50) {
  const skip = (page - 1) * limit;

  const [messages, total] = await Promise.all([
    db.message.findMany({
      where: { caseId },
      include: {
        sender: {
          include: { profile: true, professional: true },
        },
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
    }),
    db.message.count({ where: { caseId } }),
  ]);

  return { messages, total, page, limit };
}

// ============ GET CASE TIMELINE ============

export async function getCaseTimeline(caseId: string) {
  const events = await db.caseEvent.findMany({
    where: { caseId },
    orderBy: { createdAt: 'asc' },
  });

  return events;
}

// ============ SUBMIT PROOF ============

export async function submitProof(
  caseId: string,
  items: { type: string; description?: string; storageKey?: string }[]
) {
  const proofItems = await Promise.all(
    items.map((item) =>
      db.proofItem.create({
        data: {
          caseId,
          type: item.type,
          description: item.description || null,
          storageKey: item.storageKey || null,
          status: 'PENDING',
        },
      })
    )
  );

  return proofItems;
}

// ============ CUSTOMER APPROVE RESOLUTION ============

export async function customerApproveResolution(
  caseId: string,
  customerId: string
) {
  const caseRecord = await db.case.findUnique({ where: { id: caseId } });
  if (!caseRecord) throw new Error('Case not found');

  // Chain through any remaining states to reach RESOLVED
  const stateChain: Array<[string, string, string]> = [
    ['IN_PROGRESS', 'PROFESSIONAL', CASE_EVENTS.SERVICE_STARTED],
    ['PROOF', 'PROFESSIONAL', CASE_EVENTS.PROOF_SUBMITTED],
    ['CUSTOMER_REVIEW', 'CUSTOMER', CASE_EVENTS.CUSTOMER_APPROVED],
    ['COMPLETED', 'SYSTEM', CASE_EVENTS.CASE_COMPLETED],
    ['RESOLVED', 'SYSTEM', CASE_EVENTS.CASE_RESOLVED],
  ];

  for (const [state, actorType, eventType] of stateChain) {
    try {
      await transitionCase(caseId, state as CaseState, customerId, actorType);
      await addCaseEvent(caseId, eventType as CaseEventType, actorType, customerId, {
        autoTransitioned: true,
      });
    } catch {
      // State already passed or blocked - continue chain
    }
  }

  // Set resolvedAt
  await db.case.update({
    where: { id: caseId },
    data: { resolvedAt: new Date() },
  });

  return db.case.findUnique({ where: { id: caseId } });
}

// ============ OPEN DISPUTE ============

export async function openDispute(
  caseId: string,
  openedBy: string,
  reason?: string
) {
  const caseRecord = await db.case.findUnique({ where: { id: caseId } });
  if (!caseRecord) throw new Error('Case not found');

  const dispute = await db.dispute.create({
    data: {
      caseId,
      openedBy,
      reason: reason || null,
      status: 'OPEN',
    },
  });

  // Transition case to DISPUTED
  await transitionCase(caseId, 'DISPUTED' as CaseState, openedBy, ROLES.CUSTOMER);

  return dispute;
}

// ============ SUBMIT REVIEW ============

export async function submitReview(
  caseId: string,
  customerId: string,
  professionalId: string,
  rating: number,
  comment?: string
) {
  // Check for existing review
  const existing = await db.review.findUnique({
    where: {
      caseId_customerId: { caseId, customerId },
    },
  });

  if (existing) {
    throw new Error('Review already submitted for this case');
  }

  return db.review.create({
    data: {
      caseId,
      customerId,
      professionalId,
      rating: Math.min(5, Math.max(1, Math.round(rating))),
      comment: comment || null,
    },
  });
}
