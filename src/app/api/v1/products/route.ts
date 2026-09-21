import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, created, paginated, unauthorized, forbidden, badRequest, serverError } from '@/lib/api-response';
import { validateBody } from '@/lib/validate';

const CreateProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  categoryId: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  price: z.number().int().min(0, 'Selling price must be non-negative'), // in paise
  costPrice: z.number().int().min(0).default(0), // in paise
  stock: z.number().min(0).default(0),
  minStock: z.number().min(0).default(5),
  unit: z.string().default('pcs'),
  taxRate: z.number().int().min(0).default(0), // basis points (1800 = 18%)
  imageUrl: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') ?? '';
    const categoryId = searchParams.get('categoryId');
    const barcode = searchParams.get('barcode');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(200, parseInt(searchParams.get('pageSize') ?? '100'));

    const where: any = {
      orgId: session.orgId,
      isActive: true,
      ...(categoryId && categoryId !== 'all' ? { categoryId } : {}),
      ...(barcode ? { barcode } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { barcode: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);

    return paginated({ data: products, page, pageSize, total });
  } catch (err) {
    console.error('[products GET]', err);
    return serverError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!['OWNER', 'ADMIN', 'ACCOUNTANT'].includes(session.role)) return forbidden();

    const body = await request.json();
    const { data, error } = validateBody(CreateProductSchema, body);
    if (error) return error;

    if (data.barcode) {
      const existing = await prisma.product.findFirst({
        where: { orgId: session.orgId, barcode: data.barcode },
      });
      if (existing) return badRequest('A product with this barcode already exists');
    }

    const product = await prisma.product.create({
      data: {
        orgId: session.orgId,
        name: data.name,
        categoryId: data.categoryId || undefined,
        barcode: data.barcode || undefined,
        sku: data.sku || data.barcode || undefined,
        description: data.description || undefined,
        price: data.price,
        costPrice: data.costPrice,
        stock: data.stock,
        minStock: data.minStock,
        unit: data.unit,
        taxRate: data.taxRate,
        imageUrl: data.imageUrl || undefined,
      },
      include: { category: true },
    });

    return created(product);
  } catch (err) {
    console.error('[products POST]', err);
    return serverError();
  }
}
