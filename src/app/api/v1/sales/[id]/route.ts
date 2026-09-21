import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, notFound, unauthorized, serverError } from '@/lib/api-response';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const { id } = await params;

    const sale = await prisma.sale.findFirst({
      where: { id, orgId: session.orgId },
      include: {
        items: { include: { product: true } },
        org: true,
        user: { select: { id: true, name: true } },
        customer: true,
      },
    });

    if (!sale) return notFound('Bill not found');

    return ok(sale);
  } catch (err) {
    console.error('[sales/[id] GET]', err);
    return serverError();
  }
}
