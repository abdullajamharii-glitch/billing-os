import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { ok, unauthorized, badRequest, serverError, notFound } from '@/lib/api-response';
import { validateBody } from '@/lib/validate';
import { prisma } from '@/lib/prisma';
import { formatWhatsAppReceipt, formatSmsReceipt } from '@/lib/messaging/receipt-formatter';
import { sendMetaWhatsAppMessage } from '@/lib/messaging/whatsapp-cloud';
import { sendGupshupWhatsAppMessage } from '@/lib/messaging/gupshup';
import { sendSmsMessage } from '@/lib/messaging/sms-service';

const SendReceiptSchema = z.object({
  saleId: z.string().min(1),
  recipientPhone: z.string().min(5),
  channel: z.enum(['WHATSAPP', 'SMS']).default('WHATSAPP'),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const { data, error } = validateBody(SendReceiptSchema, body);
    if (error) return error;

    const [sale, org] = await Promise.all([
      prisma.sale.findUnique({
        where: { id: data.saleId, orgId: session.orgId },
        include: {
          items: true,
          customer: { select: { loyaltyPoints: true } },
        },
      }),
      prisma.organization.findUnique({
        where: { id: session.orgId },
        select: {
          name: true,
          phone: true,
          gstin: true,
          receiptFooter: true,
          messagingConfig: true,
        },
      }),
    ]);

    if (!sale) return notFound('Bill not found');

    const msgConfig = (org?.messagingConfig as any) || {};
    const provider = msgConfig.provider || 'WHATSAPP_CLOUD';

    let result: any;

    if (data.channel === 'WHATSAPP') {
      const messageText = formatWhatsAppReceipt(sale, org);

      if (provider === 'GUPSHUP') {
        result = await sendGupshupWhatsAppMessage({
          apiKey: msgConfig.gupshupApiKey,
          appName: msgConfig.gupshupAppName,
          recipientPhone: data.recipientPhone,
          messageText,
        });
      } else {
        // Default to Meta WhatsApp Cloud API
        result = await sendMetaWhatsAppMessage({
          phoneNumberId: msgConfig.metaPhoneNumberId,
          accessToken: msgConfig.metaAccessToken,
          recipientPhone: data.recipientPhone,
          messageText,
        });
      }
    } else {
      // SMS channel
      const messageText = formatSmsReceipt(sale, org);
      result = await sendSmsMessage({
        apiKey: msgConfig.smsApiKey,
        recipientPhone: data.recipientPhone,
        messageText,
      });
    }

    return ok({
      success: true,
      channel: data.channel,
      recipientPhone: data.recipientPhone,
      messageId: result.messageId,
    });
  } catch (err: any) {
    console.error('[Send Receipt Notification Error]', err);
    return serverError(err.message || 'Failed to dispatch digital receipt');
  }
}
