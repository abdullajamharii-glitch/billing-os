import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { ok, unauthorized, badRequest, serverError } from '@/lib/api-response';
import { EscPosBuilder } from '@/lib/escpos-builder';
import { sendEscPosToNetworkPrinter } from '@/lib/escpos-network';

const TestPrintSchema = z.object({
  ipAddress: z.string().min(1),
  port: z.number().int().default(9100),
  paperWidth: z.enum(['80mm', '58mm']).default('80mm'),
  autoCut: z.boolean().default(true),
  openCashDrawer: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const parsed = TestPrintSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues.map((i) => i.message).join(', '));
    const data = parsed.data;

    const builder = new EscPosBuilder({
      paperWidth: data.paperWidth,
      openCashDrawer: data.openCashDrawer,
      autoCut: data.autoCut,
    });

    builder
      .alignCenter()
      .bold(true)
      .sizeDoubleHeight()
      .textLine('TEST PRINT OK')
      .sizeNormal()
      .bold(false)
      .divider()
      .alignLeft()
      .textLine('ESC/POS Network Driver')
      .row('Date:', new Date().toLocaleString('en-IN'))
      .row('Target Host:', `${data.ipAddress}:${data.port}`)
      .row('Paper Width:', data.paperWidth)
      .divider()
      .alignCenter()
      .textLine('Printer connected and ready for billing!')
      .feed(2);

    if (data.autoCut) {
      builder.cut();
    }

    const result = await sendEscPosToNetworkPrinter(builder.toBuffer(), {
      host: data.ipAddress,
      port: data.port,
    });

    return ok(result);
  } catch (err: any) {
    console.error('[ESC/POS Test Print Error]', err);
    return serverError(err.message || 'Test print failed');
  }
}
