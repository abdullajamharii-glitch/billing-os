import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from '@/lib/api-response';
import { validateBody } from '@/lib/validate';
import { writeAuditLog } from '@/lib/audit';

const UpdateCustomerSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  currency: z.string().optional(),
  creditTermsDays: z.number().int().min(0).optional(),
  notes: z.string().optional().nullable(),
  billingAddress: z
    .object({
      line1: z.string(),
      line2: z.string().optional(),
      city: z.string(),
      state: z.string(),
      stateCode: z.string().optional(),
      pincode: z.string(),
      country: z.string().default('India'),
    })
    .optional()
    .nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const { id } = await params;

    const customer = await prisma.customer.findFirst({ where: { id, orgId: session.orgId } });
    if (!customer) return notFound('Customer not found');

    return ok({ ...customer, outstandingBalance: 0, recentInvoices: [], activeSubscriptions: [] });
  } catch (err) {
    console.error('[customers/:id GET]', err);
    return serverError();
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!['OWNER', 'ADMIN', 'ACCOUNTANT'].includes(session.role)) return forbidden();
    const { id } = await params;

    const existing = await prisma.customer.findFirst({ where: { id, orgId: session.orgId } });
    if (!existing) return notFound('Customer not found');

    const body = await request.json();
    const { data, error } = validateBody(UpdateCustomerSchema, body);
    if (error) return error;

    const updated = await prisma.$transaction(async (tx) => {
      const c = await tx.customer.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.email !== undefined && { email: data.email }),
          ...(data.phone !== undefined && { phone: data.phone }),
          ...(data.taxId !== undefined && { taxId: data.taxId }),
          ...(data.currency !== undefined && { currency: data.currency }),
          ...(data.creditTermsDays !== undefined && { creditTermsDays: data.creditTermsDays }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.billingAddress !== undefined && { billingAddress: data.billingAddress ?? undefined }),
        },
      });
      await writeAuditLog(
        { orgId: session.orgId, actorUserId: session.sub, entity: 'Customer', entityId: id, action: 'UPDATE', before: { name: existing.name }, after: { name: c.name } },
        tx
      );
      return c;
    });

    return ok(updated);
  } catch (err) {
    console.error('[customers/:id PATCH]', err);
    return serverError();
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!['OWNER', 'ADMIN'].includes(session.role)) return forbidden();
    const { id } = await params;

    const existing = await prisma.customer.findFirst({ where: { id, orgId: session.orgId } });
    if (!existing) return notFound('Customer not found');

    const hasSales = await prisma.sale.count({ where: { customerId: id, orgId: session.orgId } });
    if (hasSales > 0) return badRequest('Cannot delete customer with existing sales history');

    await prisma.$transaction(async (tx) => {
      await tx.customer.update({ where: { id }, data: { isActive: false } });
      await writeAuditLog(
        { orgId: session.orgId, actorUserId: session.sub, entity: 'Customer', entityId: id, action: 'DELETE', before: { name: existing.name } },
        tx
      );
    });

    return ok({ message: 'Customer deactivated' });
  } catch (err) {
    console.error('[customers/:id DELETE]', err);
    return serverError();
  }
}
