import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { ok, unauthorized, badRequest, serverError } from '@/lib/api-response';
import { validateBody } from '@/lib/validate';
import { createRazorpayOrder } from '@/lib/razorpay';

const CreateOrderSchema = z.object({
  amountPaise: z.number().int().positive(),
  receiptId: z.string().optional(),
  notes: z.record(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const { data, error } = validateBody(CreateOrderSchema, body);
    if (error) return error;

    const orderData = await createRazorpayOrder({
      orgId: session.orgId,
      amountPaise: data.amountPaise,
      receiptId: data.receiptId,
      notes: data.notes,
    });

    return ok(orderData);
  } catch (err: any) {
    console.error('[Razorpay create-order]', err);
    return serverError(err.message || 'Failed to create Razorpay order');
  }
}
