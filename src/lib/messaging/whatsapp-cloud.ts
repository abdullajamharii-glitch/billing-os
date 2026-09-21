/**
 * Meta WhatsApp Business Cloud API Client
 * Official Meta Graph API v20.0 (Direct without third-party markup)
 */

export interface WhatsAppCloudConfig {
  phoneNumberId?: string;
  accessToken?: string;
  recipientPhone: string;
  messageText: string;
}

export async function sendMetaWhatsAppMessage({
  phoneNumberId,
  accessToken,
  recipientPhone,
  messageText,
}: WhatsAppCloudConfig): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const token = accessToken || process.env.META_WHATSAPP_TOKEN;
  const phoneId = phoneNumberId || process.env.META_WHATSAPP_PHONE_ID;

  if (!token || !phoneId) {
    console.log('[Meta WhatsApp Simulation Mode]', { recipientPhone, messageText });
    return {
      success: true,
      messageId: `sim_meta_${Date.now()}`,
    };
  }

  // Format phone number: clean leading + or 0, ensure country code 91 for India if 10 digits
  let cleanNumber = recipientPhone.replace(/\D/g, '');
  if (cleanNumber.length === 10) {
    cleanNumber = `91${cleanNumber}`;
  }

  const endpoint = `https://graph.facebook.com/v20.0/${phoneId}/messages`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanNumber,
      type: 'text',
      text: {
        preview_url: false,
        body: messageText,
      },
    }),
  });

  if (!response.ok) {
    const errData = await response.text();
    console.error('[Meta WhatsApp Cloud Error]', errData);
    throw new Error(`WhatsApp send failed: ${errData}`);
  }

  const json = await response.json();
  const messageId = json.messages?.[0]?.id || `meta_${Date.now()}`;
  return { success: true, messageId };
}
