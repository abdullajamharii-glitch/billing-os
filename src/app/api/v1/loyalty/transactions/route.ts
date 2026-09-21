import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { paginated, unauthorized, serverError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, parseInt(searchParams.get("pageSize") ?? "25"));
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: any = {
      orgId: session.orgId,
      ...(customerId ? { customerId } : {}),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
    };

    const [transactions, total] = await Promise.all([
      prisma.loyaltyTransaction.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          sale: { select: { id: true, billNumber: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.loyaltyTransaction.count({ where }),
    ]);

    return paginated({ data: transactions, page, pageSize, total });
  } catch (err) {
    console.error("[loyalty/transactions GET]", err);
    return serverError();
  }
}
