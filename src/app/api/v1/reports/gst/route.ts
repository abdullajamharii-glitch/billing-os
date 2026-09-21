import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { ok, unauthorized, serverError } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { buildGstr1Summary } from '@/lib/gst-engine';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const now = new Date();
    let startDate = new Date();
    let endDate = new Date(now);

    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
    } else {
      switch (period) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'yesterday': {
          startDate.setDate(startDate.getDate() - 1);
          startDate.setHours(0, 0, 0, 0);
          endDate.setDate(endDate.getDate() - 1);
          endDate.setHours(23, 59, 59, 999);
          break;
        }
        case 'week': {
          const day = startDate.getDay();
          const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
          startDate.setDate(diff);
          startDate.setHours(0, 0, 0, 0);
          break;
        }
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'all':
          startDate = new Date(2020, 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }
    }

    const [sales, org] = await Promise.all([
      prisma.sale.findMany({
        where: {
          orgId: session.orgId,
          status: 'COMPLETED',
          createdAt: { gte: startDate, lte: endDate },
        },
        include: {
          items: true,
          customer: { select: { name: true, gstin: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.organization.findUnique({
        where: { id: session.orgId },
        select: { name: true, gstin: true, address: true },
      }),
    ]);

    const gstr1 = buildGstr1Summary(sales, org?.gstin);

    const b2bTaxable = gstr1.b2bInvoices.reduce((acc: number, inv: any) => acc + (inv.taxableValue || 0), 0);
    const b2bTax = gstr1.b2bInvoices.reduce((acc: number, inv: any) => acc + (inv.totalTax || 0), 0);
    const b2bTotal = gstr1.b2bInvoices.reduce((acc: number, inv: any) => acc + (inv.invoiceValue || 0), 0);
    const b2bCgst = Math.round(b2bTax / 2);
    const b2bSgst = b2bTax - b2bCgst;

    const b2cTaxable = Math.max(0, gstr1.metrics.totalTaxableValue - b2bTaxable);
    const b2cTax = Math.max(0, gstr1.metrics.totalTax - b2bTax);
    const b2cTotal = Math.max(0, gstr1.metrics.totalGrossValue - b2bTotal);
    const b2cCgst = Math.round(b2cTax / 2);
    const b2cSgst = b2cTax - b2cCgst;

    return ok({
      period,
      startDate,
      endDate,
      org: {
        name: org?.name,
        gstin: org?.gstin,
      },
      summary: {
        totalBills: gstr1.metrics.totalInvoices,
        grossTurnover: gstr1.metrics.totalGrossValue,
        taxableTurnover: gstr1.metrics.totalTaxableValue,
        cgstTotal: gstr1.metrics.totalCgst,
        sgstTotal: gstr1.metrics.totalSgst,
        igstTotal: gstr1.metrics.totalIgst,
        totalTax: gstr1.metrics.totalTax,
      },
      b2b: {
        invoiceCount: gstr1.b2bCount,
        taxableValue: b2bTaxable,
        cgst: b2bCgst,
        sgst: b2bSgst,
        igst: 0,
        totalValue: b2bTotal,
        invoices: gstr1.b2bInvoices,
      },
      b2c: {
        invoiceCount: gstr1.b2cCount,
        taxableValue: b2cTaxable,
        cgst: b2cCgst,
        sgst: b2cSgst,
        igst: 0,
        totalValue: b2cTotal,
      },
      hsnSummary: gstr1.hsnTable.map((h: any) => ({
        hsnCode: h.hsnCode,
        description: h.description,
        uqc: h.uqc,
        totalQuantity: h.totalQty,
        totalValue: h.totalValue,
        taxableValue: h.taxableValue,
        cgst: h.cgst,
        sgst: h.sgst,
        igst: h.igst,
        totalTax: h.totalTax,
      })),
      rawMetrics: gstr1.metrics,
    });
  } catch (err: any) {
    console.error('[GST Report Error]', err);
    return serverError(err.message || 'Failed to generate GST report');
  }
}
