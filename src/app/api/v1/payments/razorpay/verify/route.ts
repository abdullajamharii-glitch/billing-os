import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { ok, unauthorized, badRequest, serverError } from '@/lib/api-response';
import { validateBody } from '@/lib/validate';
import { getRazorpayConfig, verifyPaymentSignature } from '@/lib/razorpay';
import { prisma } from '@/lib/prisma';

const VerifySchema = z.object({
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  signature: z.string().optional(),
  saleId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const { data, error } = validateBody(VerifySchema, body);
    if (error) return error;

    const config = await getRazorpayConfig(session.orgId);

    // If test mode or mock order, accept verification directly
    if (config.testMode || data.orderId.startsWith('order_test_')) {
      if (data.saleId) {
        await prisma.sale.update({
          where: { id: data.saleId },
          data: {
            razorpayOrderId: data.orderId,
            razorpayPaymentId: data.paymentId,
            paymentMethod: 'UPI',
            paymentRef: data.paymentId,
          },
        });
      }
      return ok({ verified: true, isTestMode: true });
    }

    if (!config.keySecret) {
      return badRequest('Razorpay Key Secret is not configured');
    }

    if (!data.signature) {
      return badRequest('Signature is required for live verification');
    }

    const isValid = verifyPaymentSignature({
      orderId: data.orderId,
      paymentId: data.paymentId,
      signature: data.signature,
      secret: config.keySecret,
    });

    if (!isValid) {
      return badRequest('Invalid payment signature');
    }

    if (data.saleId) {
      await prisma.sale.update({
        where: { id: data.saleId },
        data: {
          razorpayOrderId: data.orderId,
          razorpayPaymentId: data.paymentId,
          paymentMethod: 'UPI',
          paymentRef: data.paymentId,
        },
      });
    }

    return ok({ verified: true, isTestMode: false });
  } catch (err: any) {
    console.error('[Razorpay verify]', err);
    return serverError(err.message || 'Payment verification failed');
  }
}
