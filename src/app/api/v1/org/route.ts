import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, unauthorized, forbidden, serverError } from '@/lib/api-response';
import { validateBody } from '@/lib/validate';
import { writeAuditLog } from '@/lib/audit';

const UpdateOrgSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  gstin: z.string().optional().nullable(),
  currency: z.string().optional(),
  paperSize: z.enum(['80mm', '58mm', 'A4']).optional(),
  receiptHeader: z.string().optional().nullable(),
  receiptFooter: z.string().optional().nullable(),
  address: z.any().optional(),
  bankDetails: z.any().optional(),
  razorpayConfig: z.any().optional(),
  printerConfig: z.any().optional(),
  messagingConfig: z.any().optional(),
});

export async function GET(_request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const org = await prisma.organization.findUnique({ where: { id: session.orgId } });
    return ok(org);
  } catch (err) {
    console.error('[org GET]', err);
    return serverError();
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!['OWNER', 'ADMIN'].includes(session.role)) {
      return forbidden('Only the owner or admin can update shop settings');
    }

    const body = await request.json();
    const { data, error } = validateBody(UpdateOrgSchema, body);
    if (error) return error;

    const existing = await prisma.organization.findUnique({ where: { id: session.orgId } });

    const updated = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.update({
        where: { id: session.orgId },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.phone !== undefined && { phone: data.phone }),
          ...(data.email !== undefined && { email: data.email }),
          ...(data.gstin !== undefined && { gstin: data.gstin }),
          ...(data.currency && { currency: data.currency }),
          ...(data.paperSize && { paperSize: data.paperSize }),
          ...(data.receiptHeader !== undefined && { receiptHeader: data.receiptHeader }),
          ...(data.receiptFooter !== undefined && { receiptFooter: data.receiptFooter }),
          ...(data.address && { address: data.address }),
          ...(data.bankDetails && { bankDetails: data.bankDetails }),
          ...(data.razorpayConfig !== undefined && { razorpayConfig: data.razorpayConfig }),
          ...(data.printerConfig !== undefined && { printerConfig: data.printerConfig }),
          ...(data.messagingConfig !== undefined && { messagingConfig: data.messagingConfig }),
        },
      });

      await writeAuditLog(
        {
          orgId: session.orgId,
          actorUserId: session.sub,
          entity: 'Organization',
          entityId: session.orgId,
          action: 'UPDATE',
          before: { name: existing?.name },
          after: { name: org.name },
        },
        tx
      );
      return org;
    });

    return ok(updated);
  } catch (err) {
    console.error('[org PATCH]', err);
    return serverError();
  }
}
