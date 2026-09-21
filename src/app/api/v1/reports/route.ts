import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, unauthorized, serverError } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') ?? 'today'; // today | week | month | all

    const now = new Date();
    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    if (period === 'yesterday') {
      startDate.setDate(startDate.getDate() - 1);
      const endDate = new Date(startDate);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (period === 'all') {
      startDate = new Date(0);
    }

    const where: any = {
      orgId: session.orgId,
      status: 'COMPLETED',
      createdAt: { gte: startDate },
    };

    // 1. Fetch sales in period
    const sales = await prisma.sale.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Calculations
    let totalRevenue = 0;
    let totalCost = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    const paymentBreakdown: Record<string, { count: number; total: number }> = {
      CASH: { count: 0, total: 0 },
      UPI: { count: 0, total: 0 },
      CARD: { count: 0, total: 0 },
      SPLIT: { count: 0, total: 0 },
      OTHER: { count: 0, total: 0 },
    };

    const itemAggMap = new Map<
      string,
      { name: string; quantity: number; revenue: number; unit: string }
    >();

    for (const s of sales) {
      totalRevenue += s.total;
      totalCost += s.costTotal;
      totalTax += s.taxTotal;
      totalDiscount += s.discountTotal;

      const pKey = s.paymentMethod;
      if (!paymentBreakdown[pKey]) {
        paymentBreakdown[pKey] = { count: 0, total: 0 };
      }
      paymentBreakdown[pKey].count += 1;
      paymentBreakdown[pKey].total += s.total;

      // Item aggregates
      for (const item of s.items) {
        const key = item.productId || item.productName;
        const existing = itemAggMap.get(key) ?? {
          name: item.productName,
          quantity: 0,
          revenue: 0,
          unit: item.unit,
        };
        existing.quantity += item.quantity;
        existing.revenue += item.lineTotal;
        itemAggMap.set(key, existing);
      }
    }

    const grossProfit = totalRevenue - totalCost;
    const profitMarginPercent =
      totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0';

    // Top selling items
    const topProducts = Array.from(itemAggMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Low stock items
    const lowStockProducts = await prisma.product.findMany({
      where: {
        orgId: session.orgId,
        isActive: true,
        stock: { lte: prisma.product.fields.minStock },
      },
      include: { category: true },
      take: 10,
    });

    return ok({
      period,
      summary: {
        totalSalesCount: sales.length,
        totalRevenue, // paise
        totalCost, // paise
        grossProfit, // paise
        profitMarginPercent,
        totalTax, // paise
        totalDiscount, // paise
        averageBillValue: sales.length > 0 ? Math.round(totalRevenue / sales.length) : 0,
      },
      paymentBreakdown,
      topProducts,
      lowStockProducts,
      recentSales: sales.slice(0, 10).map((s) => ({
        id: s.id,
        billNumber: s.billNumber,
        customerName: s.customerName,
        total: s.total,
        paymentMethod: s.paymentMethod,
        createdAt: s.createdAt,
      })),
    });
  } catch (err) {
    console.error('[reports GET]', err);
    return serverError();
  }
}
