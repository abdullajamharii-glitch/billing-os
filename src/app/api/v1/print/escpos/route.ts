import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { ok, unauthorized, badRequest, serverError, notFound } from '@/lib/api-response';
import { validateBody } from '@/lib/validate';
import { prisma } from '@/lib/prisma';
import { EscPosBuilder } from '@/lib/escpos-builder';
import { sendEscPosToNetworkPrinter } from '@/lib/escpos-network';

const PrintSchema = z.object({
  saleId: z.string().min(1),
  printerIp: z.string().optional(),
  printerPort: z.number().int().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const { data, error } = validateBody(PrintSchema, body);
    if (error) return error;

    const [sale, org] = await Promise.all([
      prisma.sale.findUnique({
        where: { id: data.saleId, orgId: session.orgId },
        include: {
          items: true,
          user: { select: { name: true } },
          customer: { select: { name: true, phone: true, loyaltyPoints: true } },
        },
      }),
      prisma.organization.findUnique({
        where: { id: session.orgId },
        select: {
          name: true,
          phone: true,
          gstin: true,
          address: true,
          receiptHeader: true,
          receiptFooter: true,
          paperSize: true,
          printerConfig: true,
        },
      }),
    ]);

    if (!sale) return notFound('Bill not found');

    const printerConfig = (org?.printerConfig as any) || {};
    const host = data.printerIp || printerConfig.ipAddress;
    const port = data.printerPort || printerConfig.port || 9100;
    const paperWidth = (printerConfig.paperWidth || org?.paperSize || '80mm') as '80mm' | '58mm';
    const autoCut = printerConfig.autoCut !== false;
    const openCashDrawer = printerConfig.openCashDrawer === true;

    if (!host) {
      return badRequest('No printer IP address configured. Please set printer IP in Shop Settings or use Browser Print.');
    }

    const billWithOrg = { ...sale, org };
    const rawBuffer = EscPosBuilder.buildBillReceipt(billWithOrg, {
      paperWidth,
      autoCut,
      openCashDrawer,
    });

    const result = await sendEscPosToNetworkPrinter(rawBuffer, { host, port });
    return ok(result);
  } catch (err: any) {
    console.error('[ESC/POS Print Error]', err);
    return serverError(err.message || 'Failed to print receipt over network');
  }
}
