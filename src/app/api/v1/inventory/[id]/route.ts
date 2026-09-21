import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, notFound, unauthorized, forbidden, serverError } from "@/lib/api-response";
import { validateBody } from "@/lib/validate";

const UpdateStockEntrySchema = z.object({
  note: z.string().optional().nullable(),
  supplierName: z.string().optional().nullable(),
  referenceNo: z.string().optional().nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const { id } = await params;
    const entry = await prisma.stockEntry.findFirst({
      where: { id, orgId: session.orgId },
      include: {
        product: { select: { id: true, name: true, barcode: true, unit: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!entry) return notFound("Stock entry not found");
    return ok(entry);
  } catch (err) {
    console.error("[inventory/[id] GET]", err);
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
    if (!["OWNER", "ADMIN", "ACCOUNTANT"].includes(session.role)) return forbidden();
    const { id } = await params;

    const existing = await prisma.stockEntry.findFirst({ where: { id, orgId: session.orgId } });
    if (!existing) return notFound("Stock entry not found");

    const body = await request.json();
    const { data, error } = validateBody(UpdateStockEntrySchema, body);
    if (error) return error;

    const updated = await prisma.stockEntry.update({
      where: { id },
      data: {
        note: data.note ?? existing.note,
        supplierName: data.supplierName ?? existing.supplierName,
        referenceNo: data.referenceNo ?? existing.referenceNo,
      },
      include: {
        product: { select: { id: true, name: true, barcode: true, unit: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    return ok(updated);
  } catch (err) {
    console.error("[inventory/[id] PATCH]", err);
    return serverError();
  }
}