import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { created, paginated, unauthorized, forbidden, badRequest, serverError } from "@/lib/api-response";

const CreateStockEntrySchema = z.object({
  productId: z.string().min(1, "Product is required"),
  type: z.enum(["PURCHASE", "ADJUSTMENT", "RETURN", "DAMAGE", "OPENING"]),
  qty: z.number().refine((n) => n !== 0, "Quantity must not be zero"),
  note: z.string().optional().nullable(),
  costPricePaise: z.number().int().min(0).default(0),
  supplierName: z.string().optional().nullable(),
  referenceNo: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const type = searchParams.get("type");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, parseInt(searchParams.get("pageSize") ?? "50"));

    const where: Record<string, unknown> = {
      orgId: session.orgId,
      ...(productId ? { productId } : {}),
      ...(type ? { type } : {}),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
    };

    const [entries, total] = await Promise.all([
      prisma.stockEntry.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, barcode: true, unit: true, stock: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.stockEntry.count({ where }),
    ]);

    return paginated({ data: entries, page, pageSize, total });
  } catch (err) {
    console.error("[inventory GET]", err);
    return serverError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!["OWNER", "ADMIN", "ACCOUNTANT"].includes(session.role)) return forbidden();

    const body = await request.json();
    const parsed = CreateStockEntrySchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map((i) => i.message).join(", "));
    }
    const data = parsed.data;

    const product = await prisma.product.findFirst({
      where: { id: data.productId, orgId: session.orgId, isActive: true },
    });
    if (!product) return badRequest("Product not found");

    const effectiveQty = data.qty;
    const newStock = Math.max(0, product.stock + effectiveQty);

    const entry = await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: data.productId },
        data: { stock: newStock },
      });

      return tx.stockEntry.create({
        data: {
          orgId: session.orgId,
          productId: data.productId,
          type: data.type,
          qty: effectiveQty,
          balanceAfter: newStock,
          note: data.note ?? null,
          costPricePaise: data.costPricePaise,
          supplierName: data.supplierName ?? null,
          referenceNo: data.referenceNo ?? null,
          createdByUserId: session.sub,
        },
        include: {
          product: { select: { id: true, name: true, barcode: true, unit: true, stock: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });
    });

    return created(entry);
  } catch (err) {
    console.error("[inventory POST]", err);
    return serverError();
  }
}