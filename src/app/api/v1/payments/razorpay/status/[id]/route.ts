import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { ok, unauthorized, badRequest, serverError } from '@/lib/api-response';
import { getRazorpayConfig } from '@/lib/razorpay';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { id: orderId } = await params;
    if (!orderId) return badRequest('Missing order ID');

    // First check if already recorded in our Sales table
    const linkedSale = await prisma.sale.findFirst({
      where: { orgId: session.orgId, razorpayOrderId: orderId },
      select: { id: true, billNumber: true, status: true, razorpayPaymentId: true },
    });

    if (linkedSale && linkedSale.razorpayPaymentId) {
      return ok({
        status: 'paid',
        paymentId: linkedSale.razorpayPaymentId,
        saleId: linkedSale.id,
        billNumber: linkedSale.billNumber,
      });
    }

    const config = await getRazorpayConfig(session.orgId);

    // If test order
    if (config.testMode || orderId.startsWith('order_test_')) {
      return ok({
        status: 'created',
        orderId,
        isTestMode: true,
      });
    }

    // Call Razorpay API to check order payments
    if (config.keyId && config.keySecret) {
      const authHeader = 'Basic ' + Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64');
      const response = await fetch(`https://api.razorpay.com/v1/orders/${orderId}/payments`, {
        headers: { Authorization: authHeader },
      });

      if (response.ok) {
        const data = await response.json();
        const successfulPayment = (data.items || []).find((p: any) => p.status === 'captured');
        if (successfulPayment) {
          return ok({
            status: 'paid',
            paymentId: successfulPayment.id,
            method: successfulPayment.method,
          });
        }
      }
    }

    return ok({ status: 'pending', orderId });
  } catch (err: any) {
    console.error('[Razorpay status]', err);
    return serverError('Failed to check order status');
  }
}
