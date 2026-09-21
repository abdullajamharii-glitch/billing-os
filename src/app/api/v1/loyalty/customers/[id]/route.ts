import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, unauthorized, forbidden, notFound, badRequest, serverError } from '@/lib/api-response';
import { validateBody } from '@/lib/validate';

const AdjustSchema = z.object({
  action: z.enum(['EARN', 'REDEEM', 'ADJUST']),
  points: z.number().int().positive(),
  note: z.string().optional(),
  saleId: z.string().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const { id } = await params;
    const customer = await prisma.customer.findFirst({ where: { id, orgId: session.orgId, isActive: true } });
    if (!customer) return notFound('Customer not found');
    const transactions = await prisma.loyaltyTransaction.findMany({
      where: { customerId: id },
      include: { sale: { select: { billNumber: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const earnAgg = await prisma.loyaltyTransaction.aggregate({ where: { customerId: id, type: 'EARN' }, _sum: { points: true } });
    const redeemAgg = await prisma.loyaltyTransaction.aggregate({ where: { customerId: id, type: 'REDEEM' }, _sum: { points: true } });
    return ok({ ...customer, lifetimeEarned: earnAgg._sum.points ?? 0, lifetimeRedeemed: Math.abs(redeemAgg._sum.points ?? 0), transactions });
  } catch (err) { console.error('[loyalty/customers/:id GET]', err); return serverError(); }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!['OWNER', 'ADMIN'].includes(session.role)) return forbidden();
    const { id } = await params;
    const body = await request.json();
    const { data, error } = validateBody(AdjustSchema, body);
    if (error) return error;
    const customer = await prisma.customer.findFirst({ where: { id, orgId: session.orgId, isActive: true } });
    if (!customer) return notFound('Customer not found');
    if (data.action === 'REDEEM') {
      const config = await prisma.loyaltyConfig.findUnique({ where: { orgId: session.orgId } });
      const minPts = config?.minPointsRedeem ?? 50;
      if (customer.loyaltyPoints < data.points) return badRequest('Insufficient loyalty points');
      if (data.points < minPts) return badRequest(`Minimum ${minPts} points required to redeem`);
    }
    const result = await prisma.$transaction(async (tx) => {
      const delta = data.action === 'REDEEM' ? -data.points : data.points;
      const newBalance = customer.loyaltyPoints + delta;
      await tx.customer.update({ where: { id }, data: { loyaltyPoints: newBalance } });
      const txn = await tx.loyaltyTransaction.create({ data: { orgId: session.orgId, customerId: id, saleId: data.saleId, type: data.action, points: delta, balanceAfter: newBalance, note: data.note } });
      return { newBalance, transaction: txn };
    });
    return ok(result);
  } catch (err) { console.error('[loyalty/customers/:id POST]', err); return serverError(); }
}