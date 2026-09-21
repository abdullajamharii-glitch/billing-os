import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { ok, unauthorized, badRequest, serverError } from '@/lib/api-response';
import { validateBody } from '@/lib/validate';
import { sendMetaWhatsAppMessage } from '@/lib/messaging/whatsapp-cloud';
import { sendGupshupWhatsAppMessage } from '@/lib/messaging/gupshup';
import { sendSmsMessage } from '@/lib/messaging/sms-service';

const TestNotificationSchema = z.object({
  channel: z.enum(['WHATSAPP', 'SMS']).default('WHATSAPP'),
  provider: z.enum(['META_WHATSAPP', 'GUPSHUP', 'SMS']).default('META_WHATSAPP'),
  recipientPhone: z.string().min(5),
  apiKey: z.string().optional(),
  token: z.string().optional(),
  phoneNumberId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const { data, error } = validateBody(TestNotificationSchema, body);
    if (error) return error;

    const testMessage = `Hello from Fried Zone POS! 🍗\nThis is a test notification verifying your API setup.\nTime: ${new Date().toLocaleTimeString('en-IN')}`;

    let result: any;
    if (data.provider === 'META_WHATSAPP') {
      result = await sendMetaWhatsAppMessage({
        phoneNumberId: data.phoneNumberId,
        accessToken: data.token,
        recipientPhone: data.recipientPhone,
        messageText: testMessage,
      });
    } else if (data.provider === 'GUPSHUP') {
      result = await sendGupshupWhatsAppMessage({
        apiKey: data.apiKey,
        recipientPhone: data.recipientPhone,
        messageText: testMessage,
      });
    } else {
      result = await sendSmsMessage({
        apiKey: data.apiKey,
        recipientPhone: data.recipientPhone,
        messageText: testMessage,
      });
    }

    return ok({
      success: true,
      provider: data.provider,
      messageId: result.messageId,
    });
  } catch (err: any) {
    console.error('[Notification Test Error]', err);
    return serverError(err.message || 'Notification test failed');
  }
}
