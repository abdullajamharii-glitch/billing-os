import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { created, paginated, unauthorized, forbidden, serverError } from '@/lib/api-response';
import { validateBody } from '@/lib/validate';
import { writeAuditLog } from '@/lib/audit';

const CreateCustomerSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  gstin: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '50'));
    const search = searchParams.get('search') ?? '';

    const where: any = {
      orgId: session.orgId,
      isActive: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          _count: { select: { sales: true } },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.customer.count({ where }),
    ]);

    return paginated({ data: customers, page, pageSize, total });
  } catch (err) {
    console.error('[customers GET]', err);
    return serverError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!['OWNER', 'ADMIN', 'ACCOUNTANT', 'CASHIER'].includes(session.role)) return forbidden();

    const body = await request.json();
    const { data, error } = validateBody(CreateCustomerSchema, body);
    if (error) return error;

    const customer = await prisma.$transaction(async (tx) => {
      const cust = await tx.customer.create({
        data: {
          orgId: session.orgId,
          name: data.name,
          phone: data.phone || undefined,
          email: data.email || undefined,
          gstin: data.gstin || undefined,
          address: data.address || undefined,
        },
      });

      await writeAuditLog(
        {
          orgId: session.orgId,
          actorUserId: session.sub,
          entity: 'Customer',
          entityId: cust.id,
          action: 'CREATE',
          after: { name: cust.name, phone: cust.phone },
        },
        tx
      );

      return cust;
    });

    return created(customer);
  } catch (err) {
    console.error('[customers POST]', err);
    return serverError();
  }
}
