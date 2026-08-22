// ============================================================
// REZZO Vault — Document Service
// ============================================================
//
// PRD §13: identity/property/business/government/case documents, kept
// private by default and shared only when the owner explicitly authorizes
// a specific document for a specific case (§13.2 "permissioned reuse" —
// never the whole Vault).
//
// V1 has no real blob storage (S3, etc.) wired up, so a document's bytes
// are stored as a base64 data URI directly in Document.storageKey — that
// field is meant to hold a reference to storage, and for now the
// "reference" is the content itself. Swapping in real storage later only
// means storageKey becomes an actual key instead of a data URI; nothing
// else about this model needs to change.

import { db } from '@/lib/db';

export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024; // 4MB

export interface UploadDocumentInput {
  name: string;
  type: string;
  mimeType: string;
  dataBase64: string;
}

export async function uploadDocument(ownerUserId: string, input: UploadDocumentInput) {
  const bytes = Buffer.from(input.dataBase64, 'base64');
  if (bytes.length === 0) {
    throw new Error('File appears to be empty');
  }
  if (bytes.length > MAX_DOCUMENT_BYTES) {
    throw new Error(`File is too large — max ${MAX_DOCUMENT_BYTES / (1024 * 1024)}MB`);
  }

  return db.document.create({
    data: {
      ownerUserId,
      storageKey: `data:${input.mimeType};base64,${input.dataBase64}`,
      type: input.type,
      name: input.name,
      metadataJson: { mimeType: input.mimeType, sizeBytes: bytes.length },
    },
  });
}

export async function listUserDocuments(ownerUserId: string) {
  return db.document.findMany({
    where: { ownerUserId },
    select: {
      id: true,
      type: true,
      name: true,
      metadataJson: true,
      createdAt: true,
      expiresAt: true,
      permissions: {
        where: { revokedAt: null },
        select: { id: true, caseId: true, recipientUserId: true, scope: true, expiresAt: true, createdAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function deleteDocument(documentId: string, ownerUserId: string) {
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error('Document not found');
  if (doc.ownerUserId !== ownerUserId) throw new Error('You do not own this document');

  await db.documentPermission.deleteMany({ where: { documentId } });
  await db.document.delete({ where: { id: documentId } });
}

/**
 * Grant a specific document to a specific case (§13.2). If the case has an
 * accepted quote, the assigned professional becomes the recipient; the
 * share still exists (and revoke still works) even before one does.
 * Re-sharing an already-actively-shared doc/case pair is a no-op, not a
 * duplicate row.
 */
export async function shareDocumentWithCase(documentId: string, ownerUserId: string, caseId: string) {
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error('Document not found');
  if (doc.ownerUserId !== ownerUserId) throw new Error('You do not own this document');

  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
    include: { quotes: { where: { status: 'ACCEPTED' }, include: { professional: true } } },
  });
  if (!caseRecord) throw new Error('Case not found');
  if (caseRecord.userId !== ownerUserId) throw new Error('You do not own this case');

  const existing = await db.documentPermission.findFirst({
    where: { documentId, caseId, revokedAt: null },
  });
  if (existing) return existing;

  return db.documentPermission.create({
    data: {
      documentId,
      caseId,
      recipientUserId: caseRecord.quotes[0]?.professional?.userId ?? null,
      scope: 'FULL_CASE_DOCUMENT',
    },
  });
}

export async function revokeDocumentShare(permissionId: string, ownerUserId: string) {
  const permission = await db.documentPermission.findUnique({
    where: { id: permissionId },
    include: { document: true },
  });
  if (!permission) throw new Error('Share not found');
  if (permission.document.ownerUserId !== ownerUserId) throw new Error('You do not own this document');

  return db.documentPermission.update({
    where: { id: permissionId },
    data: { revokedAt: new Date() },
  });
}

function permissionIsLive(p: { expiresAt: Date | null; revokedAt?: Date | null }) {
  if (p.revokedAt) return false;
  if (p.expiresAt && p.expiresAt < new Date()) return false;
  return true;
}

/**
 * Full document (including storageKey/content) for a viewer who isn't
 * necessarily the owner — owner or admin always allowed; anyone else needs
 * a live, unrevoked, unexpired DocumentPermission naming them as recipient.
 */
export async function getDocumentForViewer(documentId: string, viewerUserId: string, isAdmin: boolean) {
  const doc = await db.document.findUnique({
    where: { id: documentId },
    include: { permissions: true },
  });
  if (!doc) throw new Error('Document not found');
  if (doc.ownerUserId === viewerUserId || isAdmin) return doc;

  const hasAccess = doc.permissions.some(
    (p) => p.recipientUserId === viewerUserId && permissionIsLive(p)
  );
  if (!hasAccess) throw new Error('You do not have access to this document');
  return doc;
}

/** Documents actively shared into a given case — for the professional/admin case view. */
export async function listCaseDocuments(caseId: string) {
  const permissions = await db.documentPermission.findMany({
    where: { caseId, revokedAt: null },
    include: {
      document: { select: { id: true, name: true, type: true, metadataJson: true, ownerUserId: true, createdAt: true } },
    },
  });
  return permissions.filter(permissionIsLive).map((p) => p.document);
}
