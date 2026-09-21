import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, notFound, unauthorized, forbidden, serverError } from '@/lib/api-response';
import { validateBody } from '@/lib/validate';

const UpdateProductSchema = z.object({
  name: z.string().min(1).optional(),
  categoryId: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  price: z.number().int().min(0).optional(),
  costPrice: z.number().int().min(0).optional(),
  stock: z.number().min(0).optional(),
  minStock: z.number().min(0).optional(),
  unit: z.string().optional(),
  taxRate: z.number().int().min(0).optional(),
  imageUrl: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const { id } = await params;

    const product = await prisma.product.findFirst({
      where: { id, orgId: session.orgId },
      include: { category: true },
    });
    if (!product) return notFound('Product not found');

    return ok(product);
  } catch (err) {
    console.error('[products/[id] GET]', err);
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

    const body = await request.json();
    const { data, error } = validateBody(UpdateProductSchema, body);
    if (error) return error;

    const updated = await prisma.product.update({
      where: { id },
      data,
      include: { category: true },
    });

    return ok(updated);
  } catch (err) {
    console.error('[products/[id] PATCH]', err);
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
    if (!['OWNER', 'ADMIN', 'ACCOUNTANT'].includes(session.role)) return forbidden();
    const { id } = await params;

    const existing = await prisma.product.findFirst({
      where: { id, orgId: session.orgId },
    });
    if (!existing) return notFound('Product not found');

    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    return ok({ success: true, message: 'Product removed' });
  } catch (err) {
    console.error('[products/[id] DELETE]', err);
    return serverError();
  }
}
