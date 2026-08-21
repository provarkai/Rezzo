// ============================================================
// REZZO Audit Log
// ============================================================
//
// "Admin actions require audit logging" (PRD §13, Identity & RBAC). The
// AuditLog model has existed since the original transfer but nothing ever
// wrote to it — every admin action in the app was untracked. Wired into
// the admin-only mutations that most obviously need a record: professional
// verification decisions, bypass-signal reviews, dispute resolutions.

import { db } from '@/lib/db';

export interface AuditActionInput {
  actorId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Never let audit logging block the action it's recording — same
 * best-effort discipline as notify(). A failed audit write is a gap in
 * the record, not a reason to fail an admin's real action.
 */
export async function logAdminAction(input: AuditActionInput) {
  try {
    return await db.auditLog.create({
      data: {
        actorType: 'ADMIN',
        actorId: input.actorId,
        action: input.action,
        resourceType: input.resourceType || null,
        resourceId: input.resourceId || null,
        metadataJson: input.metadata ? (input.metadata as object) : undefined,
      },
    });
  } catch {
    return null;
  }
}
