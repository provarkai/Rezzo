// ============================================================
// High-Risk Category Detection (PRD §16.2)
// ============================================================
//
// Deliberately has zero dependency on db/case-engine/ai-orchestrator —
// same split as payment-providers/paystack.ts and
// messaging-providers/whatsapp.ts: pure logic, unit-testable on its own,
// imported by the DB-touching orchestrator rather than living inside it.
//
// A deterministic keyword safety net that runs independent of whatever
// the classifier (mock or LLM) decided — the point of this control is
// that it doesn't rely on the AI's own judgment of its risk. Legal,
// Financial, Healthcare, Government/identity and Safety-critical technical
// work all force human escalation regardless of how confident the
// classifier was.

import { HIGH_RISK_CATEGORIES } from './constants';

export const HIGH_RISK_SIGNALS: Record<string, string[]> = {
  [HIGH_RISK_CATEGORIES.LEGAL]: ['lawsuit', 'suing', 'sue me', 'court case', 'eviction', 'legal action', 'contract dispute', 'litigation', 'sued'],
  [HIGH_RISK_CATEGORIES.FINANCIAL]: ['loan default', 'investment scam', 'fraud', 'ponzi', 'embezzle', 'debt collection', 'bankrupt'],
  [HIGH_RISK_CATEGORIES.HEALTHCARE]: ['medical condition', 'diagnosis', 'surgery', 'hospitaliz', 'prescription', 'medical emergency', 'injury from'],
  [HIGH_RISK_CATEGORIES.GOVERNMENT_IDENTITY]: ['immigration', 'deportation', 'citizenship', 'identity theft', 'stolen identity'],
  [HIGH_RISK_CATEGORIES.SAFETY_CRITICAL]: ['gas leak', 'fire hazard', 'exposed wire', 'structural damage', 'building collapse', 'electrical fire', 'carbon monoxide'],
};

export function detectHighRiskCategory(rawInput: string): string | null {
  const input = rawInput.toLowerCase();
  for (const [category, keywords] of Object.entries(HIGH_RISK_SIGNALS)) {
    if (keywords.some((kw) => input.includes(kw))) return category;
  }
  return null;
}
