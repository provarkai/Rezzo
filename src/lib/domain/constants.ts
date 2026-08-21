// ============================================================
// REZZO Domain Constants & Types
// ============================================================

// ============ CASE STATES ============
export const CASE_STATES = {
  NEW: 'NEW',
  UNDERSTANDING: 'UNDERSTANDING',
  CLARIFICATION: 'CLARIFICATION',
  ROUTED: 'ROUTED',
  MATCHING: 'MATCHING',
  QUOTE: 'QUOTE',
  ACCEPTED: 'ACCEPTED',
  PAYMENT: 'PAYMENT',
  FUNDED: 'FUNDED',
  IN_PROGRESS: 'IN_PROGRESS',
  PROOF: 'PROOF',
  CUSTOMER_REVIEW: 'CUSTOMER_REVIEW',
  COMPLETED: 'COMPLETED',
  RESOLVED: 'RESOLVED',
  DECLINED: 'DECLINED',
  CANCELLED: 'CANCELLED',
  DISPUTED: 'DISPUTED',
  ESCALATED: 'ESCALATED',
  REFUNDED: 'REFUNDED',
} as const;

export type CaseState = (typeof CASE_STATES)[keyof typeof CASE_STATES];

// ============ ROLES ============
export const ROLES = {
  CUSTOMER: 'CUSTOMER',
  PROFESSIONAL: 'PROFESSIONAL',
  ADMIN: 'ADMIN',
  OPS: 'OPS',
  SUPPORT: 'SUPPORT',
  SYSTEM: 'SYSTEM',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// ============ CASE EVENTS ============
export const CASE_EVENTS = {
  CASE_CREATED: 'CASE_CREATED',
  AI_UNDERSTANDING: 'AI_UNDERSTANDING',
  CLARIFICATION_REQUESTED: 'CLARIFICATION_REQUESTED',
  ROUTE_SELECTED: 'ROUTE_SELECTED',
  MATCHES_GENERATED: 'MATCHES_GENERATED',
  PROFESSIONAL_SELECTED: 'PROFESSIONAL_SELECTED',
  QUOTE_RECEIVED: 'QUOTE_RECEIVED',
  QUOTE_ACCEPTED: 'QUOTE_ACCEPTED',
  PAYMENT_INITIATED: 'PAYMENT_INITIATED',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  SERVICE_STARTED: 'SERVICE_STARTED',
  MILESTONE_SUBMITTED: 'MILESTONE_SUBMITTED',
  PROOF_SUBMITTED: 'PROOF_SUBMITTED',
  CUSTOMER_APPROVED: 'CUSTOMER_APPROVED',
  CASE_COMPLETED: 'CASE_COMPLETED',
  CASE_RESOLVED: 'CASE_RESOLVED',
  DISPUTE_OPENED: 'DISPUTE_OPENED',
  ESCALATED: 'ESCALATED',
  CASE_CANCELLED: 'CASE_CANCELLED',
} as const;

export type CaseEventType = (typeof CASE_EVENTS)[keyof typeof CASE_EVENTS];

// ============ PAYMENT STATES ============
export const PAYMENT_STATES = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  FUNDED: 'FUNDED',
  PARTIALLY_FUNDED: 'PARTIALLY_FUNDED',
  REFUND_PENDING: 'REFUND_PENDING',
  REFUNDED: 'REFUNDED',
  PAYOUT_PENDING: 'PAYOUT_PENDING',
  PAID_OUT: 'PAID_OUT',
  CHARGEBACK: 'CHARGEBACK',
} as const;

export type PaymentState = (typeof PAYMENT_STATES)[keyof typeof PAYMENT_STATES];

// ============ VERTICALS ============
export const VERTICALS = {
  HOME_TECHNICAL: 'HOME_TECHNICAL',
  PROPERTY_HOUSING: 'PROPERTY_HOUSING',
  BUSINESS_ENTERPRISE: 'BUSINESS_ENTERPRISE',
  GOVERNMENT_DOCUMENTATION: 'GOVERNMENT_DOCUMENTATION',
} as const;

export type Vertical = (typeof VERTICALS)[keyof typeof VERTICALS];

// ============ OTHER ENUMS ============
export const USER_STATUSES = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  DELETED: 'DELETED',
} as const;

export const URGENCY_LEVELS = {
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

export const RISK_LEVELS = {
  NORMAL: 'NORMAL',
  ELEVATED: 'ELEVATED',
  HIGH: 'HIGH',
} as const;

export const VERIFICATION_STATUSES = {
  PENDING: 'PENDING',
  NEEDS_INFO: 'NEEDS_INFO',
  VERIFIED: 'VERIFIED',
  TRUSTED: 'TRUSTED',
  EXPERT: 'EXPERT',
  SUSPENDED: 'SUSPENDED',
  REVOKED: 'REVOKED',
} as const;

export const AVAILABILITY_STATUSES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;

export const CREDENTIAL_TYPES = {
  IDENTITY: 'IDENTITY',
  LICENSE: 'LICENSE',
  CERTIFICATE: 'CERTIFICATE',
  DEGREE: 'DEGREE',
} as const;

export const PRICING_TYPES = {
  FIXED: 'FIXED',
  STARTING_FROM: 'STARTING_FROM',
  QUOTE_REQUIRED: 'QUOTE_REQUIRED',
  HOURLY: 'HOURLY',
  MILESTONE: 'MILESTONE',
} as const;

export const QUOTE_STATUSES = {
  SENT: 'SENT',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  EXPIRED: 'EXPIRED',
} as const;

export const BOOKING_STATUSES = {
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export const MILESTONE_STATUSES = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export const DISPUTE_STATUSES = {
  OPEN: 'OPEN',
  UNDER_REVIEW: 'UNDER_REVIEW',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const;

export const KNOWLEDGE_AUTHORITY_LEVELS = {
  A: 'A', // Official
  B: 'B', // Approved professional
  C: 'C', // General
} as const;

// ============ TRUST / PAYMENT PROTECTION / ANTI-BYPASS (PRD Upgrade) ============
export const PROTECTION_STATUSES = {
  NONE: 'NONE',
  ELIGIBLE: 'ELIGIBLE',
  PROTECTED: 'PROTECTED',
} as const;

export const TRANSACTION_MODES = {
  ON_PLATFORM: 'ON_PLATFORM',
  OFF_PLATFORM_SUSPECTED: 'OFF_PLATFORM_SUSPECTED',
  OFF_PLATFORM_CONFIRMED: 'OFF_PLATFORM_CONFIRMED',
} as const;

export const BYPASS_SIGNAL_TYPES = {
  DIRECT_PAYMENT_DETAILS: 'DIRECT_PAYMENT_DETAILS',
  OFF_PLATFORM_REQUEST: 'OFF_PLATFORM_REQUEST',
  REPEATED_CONTACT_REQUEST: 'REPEATED_CONTACT_REQUEST',
  POST_ACCEPT_CANCELLATION: 'POST_ACCEPT_CANCELLATION',
  OTHER: 'OTHER',
} as const;

// Mirrors the four progressive intervention levels in the PRD Upgrade §6.2:
// LOW = friendly reminder, MEDIUM = warning, HIGH = ops review, CONFIRMED = enforcement.
export const BYPASS_SEVERITY_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CONFIRMED: 'CONFIRMED',
} as const;

export const BYPASS_SIGNAL_STATUSES = {
  OPEN: 'OPEN',
  REVIEWED: 'REVIEWED',
  DISMISSED: 'DISMISSED',
  ACTION_TAKEN: 'ACTION_TAKEN',
} as const;

export const PROTECTION_BENEFIT_TYPES = {
  PAYMENT_RECORD: 'PAYMENT_RECORD',
  PROOF_RECORD: 'PROOF_RECORD',
  DISPUTE_PATH: 'DISPUTE_PATH',
  VERIFIED_PROFESSIONAL: 'VERIFIED_PROFESSIONAL',
  CASE_HISTORY: 'CASE_HISTORY',
  SUPPORT: 'SUPPORT',
  FOLLOW_UP: 'FOLLOW_UP',
} as const;

export const PROTECTION_BENEFIT_STATUSES = {
  INACTIVE: 'INACTIVE',
  ACTIVE: 'ACTIVE',
  USED: 'USED',
  EXPIRED: 'EXPIRED',
} as const;

export const FOLLOWUP_TRIGGER_TYPES = {
  MAINTENANCE_REMINDER: 'MAINTENANCE_REMINDER',
  WARRANTY_CHECK: 'WARRANTY_CHECK',
  DOCUMENTATION_ROUTE: 'DOCUMENTATION_ROUTE',
  TAX_COMPLIANCE_ROUTE: 'TAX_COMPLIANCE_ROUTE',
  REPEAT_SERVICE: 'REPEAT_SERVICE',
  OTHER: 'OTHER',
} as const;

export const FOLLOWUP_STATUSES = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  DISMISSED: 'DISMISSED',
  COMPLETED: 'COMPLETED',
} as const;

export const COMMISSION_REVERSAL_STATUSES = {
  NONE: 'NONE',
  PARTIALLY_REVERSED: 'PARTIALLY_REVERSED',
  FULLY_REVERSED: 'FULLY_REVERSED',
} as const;

// ============ FINANCIAL CONSTANTS ============
export const COMMISSION_RATE = 0.10;
export const CURRENCY = 'NGN';
export const CASE_NUMBER_PREFIX = 'RZ';
export const CASE_NUMBER_START = 10000;

// ============ AI SYSTEM PROMPT ============
export const AI_REZZO_SYSTEM_PROMPT = `You are AI REZZO, the orchestration intelligence of REZZO. Your job is to coordinate the safest and most effective path toward the customer's stated outcome. You do not replace licensed professionals or government authorities. Separate facts, customer-provided information, professional advice and AI recommendations. Ask only questions that materially affect the route. Use only approved tools and sources. Never fabricate requirements, prices, credentials, outcomes or payment states. When risk is high, confidence is low, or professional judgment is required, escalate. Never declare a Case resolved without its resolution criteria being satisfied.

You must respond with valid JSON only, using this exact structure:
{
  "intent": "string - what the customer wants to achieve",
  "need": "string - classified need category",
  "matter": "string - specific matter description",
  "category": "string - service category for matching (e.g., AC_REPAIR, PLUMBING, ELECTRICAL)",
  "vertical": "string - one of HOME_TECHNICAL, PROPERTY_HOUSING, BUSINESS_ENTERPRISE, GOVERNMENT_DOCUMENTATION",
  "riskLevel": "string - NORMAL, ELEVATED, or HIGH",
  "missingInformation": ["string - list of missing critical info"],
  "route": "string - recommended resolution route",
  "requiredExpertise": ["string - skills needed"],
  "requiredDocuments": ["string - documents needed"],
  "nextAction": "string - what should happen next",
  "confidence": number 0-100,
  "humanRequired": boolean
}`;

// ============ CASE STATE MACHINE ============
export type StateTransition = {
  from: CaseState | '*';
  to: CaseState;
};

export const CASE_STATE_TRANSITIONS: StateTransition[] = [
  // Initial flow
  { from: 'NEW', to: 'UNDERSTANDING' },
  { from: 'NEW', to: 'CANCELLED' },
  { from: 'UNDERSTANDING', to: 'CLARIFICATION' },
  { from: 'UNDERSTANDING', to: 'ROUTED' },
  { from: 'UNDERSTANDING', to: 'CANCELLED' },
  { from: 'CLARIFICATION', to: 'ROUTED' },
  { from: 'CLARIFICATION', to: 'CANCELLED' },
  { from: 'ROUTED', to: 'MATCHING' },
  { from: 'ROUTED', to: 'CANCELLED' },
  { from: 'MATCHING', to: 'QUOTE' },
  { from: 'MATCHING', to: 'DECLINED' },
  { from: 'MATCHING', to: 'CANCELLED' },
  { from: 'QUOTE', to: 'ACCEPTED' },
  { from: 'QUOTE', to: 'DECLINED' },
  { from: 'QUOTE', to: 'CANCELLED' },
  { from: 'ACCEPTED', to: 'PAYMENT' },
  { from: 'ACCEPTED', to: 'CANCELLED' },
  { from: 'PAYMENT', to: 'FUNDED' },
  { from: 'PAYMENT', to: 'FAILED' },
  { from: 'FUNDED', to: 'IN_PROGRESS' },
  { from: 'IN_PROGRESS', to: 'PROOF' },
  { from: 'IN_PROGRESS', to: 'DISPUTED' },
  { from: 'PROOF', to: 'CUSTOMER_REVIEW' },
  { from: 'PROOF', to: 'DISPUTED' },
  { from: 'CUSTOMER_REVIEW', to: 'COMPLETED' },
  { from: 'CUSTOMER_REVIEW', to: 'PROOF' },
  { from: 'CUSTOMER_REVIEW', to: 'DISPUTED' },
  { from: 'COMPLETED', to: 'RESOLVED' },
  { from: 'DECLINED', to: 'CANCELLED' },

  // Dispute/escalation flows from any active state
  { from: '*', to: 'DISPUTED' },
  { from: '*', to: 'ESCALATED' },
  { from: '*', to: 'CANCELLED' },

  // Resolution from dispute
  { from: 'DISPUTED', to: 'IN_PROGRESS' },
  { from: 'DISPUTED', to: 'RESOLVED' },
  { from: 'DISPUTED', to: 'REFUNDED' },
  { from: 'ESCALATED', to: 'IN_PROGRESS' },
  { from: 'ESCALATED', to: 'RESOLVED' },
  { from: 'ESCALATED', to: 'REFUNDED' },
  { from: 'REFUNDED', to: 'RESOLVED' },
];

// ============ UTILITY ============
export function isValidTransition(from: CaseState, to: CaseState): boolean {
  // Check exact match
  const exactMatch = CASE_STATE_TRANSITIONS.find(
    (t) => t.from === from && t.to === to
  );
  if (exactMatch) return true;

  // Check wildcard transitions (dispute, escalation, cancellation)
  const wildcardMatch = CASE_STATE_TRANSITIONS.find(
    (t) => t.from === '*' && t.to === to
  );
  if (wildcardMatch) return true;

  return false;
}

export function generateCaseNumber(count: number): string {
  return `${CASE_NUMBER_PREFIX}-${CASE_NUMBER_START + count}`;
}

export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG')}`;
}

// ============ API RESPONSE HELPERS ============
export function successResponse<T>(data: T, meta?: Record<string, unknown>) {
  return {
    data,
    meta: {
      request_id: crypto.randomUUID(),
      ...meta,
    },
  };
}

export function errorResponse(code: string, message: string, status: number = 400) {
  return {
    error: {
      code,
      message,
    },
    status,
  };
}
