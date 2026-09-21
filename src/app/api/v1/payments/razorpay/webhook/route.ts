import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWebhookSignature } from '@/lib/razorpay';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature');

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const event = payload.event;
    console.log(`[Razorpay Webhook Received] event: ${event}`);

    // If order.paid or payment.captured
    if (event === 'payment.captured' || event === 'order.paid') {
      const payment = payload.payload?.payment?.entity;
      const orderId = payment?.order_id || payload.payload?.order?.entity?.id;
      const paymentId = payment?.id;

      if (orderId && paymentId) {
        // Find if any sale was linked with this order
        const sale = await prisma.sale.findFirst({
          where: { razorpayOrderId: orderId },
        });

        if (sale) {
          await prisma.sale.update({
            where: { id: sale.id },
            data: {
              razorpayPaymentId: paymentId,
              paymentMethod: 'UPI',
              paymentRef: paymentId,
              status: 'COMPLETED',
            },
          });
          console.log(`[Razorpay Webhook] Updated sale ${sale.billNumber} with payment ${paymentId}`);
        }
      }
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (err: any) {
    console.error('[Razorpay Webhook Error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
