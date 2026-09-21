import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { paginated, unauthorized, forbidden, serverError } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!['OWNER', 'ADMIN', 'ACCOUNTANT'].includes(session.role)) return forbidden();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
    const entity = searchParams.get('entity');
    const entityId = searchParams.get('entity_id');

    const where = {
      orgId: session.orgId,
      ...(entity && { entity }),
      ...(entityId && { entityId }),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return paginated({ data: logs, page, pageSize, total });
  } catch (err) {
    console.error('[audit-logs GET]', err);
    return serverError();
  }
}
