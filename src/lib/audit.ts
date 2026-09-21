import { prisma } from './prisma';

export interface AuditEntry {
  orgId: string;
  actorUserId?: string;
  entity: string;
  entityId: string;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

/**
 * Write an audit log entry.
 * Pass `tx` to run inside an existing Prisma transaction.
 */
export async function writeAuditLog(
  entry: AuditEntry,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: any
): Promise<void> {
  const db = tx ?? prisma;
  await db.auditLog.create({
    data: {
      orgId: entry.orgId,
      actorUserId: entry.actorUserId ?? null,
      entity: entry.entity,
      entityId: entry.entityId,
      action: entry.action,
      before: entry.before ?? undefined,
      after: entry.after ?? undefined,
    },
  });
}
