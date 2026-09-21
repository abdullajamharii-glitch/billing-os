import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, created, unauthorized, forbidden, badRequest, serverError } from '@/lib/api-response';
import { validateBody } from '@/lib/validate';

const CreateCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  color: z.string().optional().default('#e05c2b'),
  icon: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

export async function GET(_request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const categories = await prisma.category.findMany({
      where: { orgId: session.orgId, isActive: true },
      include: {
        _count: { select: { products: { where: { isActive: true } } } },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return ok(categories);
  } catch (err) {
    console.error('[categories GET]', err);
    return serverError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!['OWNER', 'ADMIN', 'ACCOUNTANT'].includes(session.role)) return forbidden();

    const body = await request.json();
    const { data, error } = validateBody(CreateCategorySchema, body);
    if (error) return error;

    const existing = await prisma.category.findUnique({
      where: { orgId_name: { orgId: session.orgId, name: data.name } },
    });
    if (existing) return badRequest('Category already exists');

    const category = await prisma.category.create({
      data: {
        orgId: session.orgId,
        name: data.name,
        color: data.color,
        icon: data.icon,
        sortOrder: data.sortOrder,
      },
    });

    return created(category);
  } catch (err) {
    console.error('[categories POST]', err);
    return serverError();
  }
}
