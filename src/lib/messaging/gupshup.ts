/**
 * Gupshup WhatsApp Messaging Client
 */

export interface GupshupConfig {
  apiKey?: string;
  appName?: string;
  sourceNumber?: string;
  recipientPhone: string;
  messageText: string;
}

export async function sendGupshupWhatsAppMessage({
  apiKey,
  appName,
  sourceNumber,
  recipientPhone,
  messageText,
}: GupshupConfig): Promise<{ success: boolean; messageId?: string }> {
  const key = apiKey || process.env.GUPSHUP_API_KEY;

  if (!key) {
    console.log('[Gupshup Simulation Mode]', { recipientPhone, messageText });
    return {
      success: true,
      messageId: `sim_gupshup_${Date.now()}`,
    };
  }

  let cleanNumber = recipientPhone.replace(/\D/g, '');
  if (cleanNumber.length === 10) {
    cleanNumber = `91${cleanNumber}`;
  }

  const endpoint = 'https://api.gupshup.io/wa/api/v1/msg';
  const formData = new URLSearchParams();
  formData.append('channel', 'whatsapp');
  formData.append('source', sourceNumber || '917834811114');
  formData.append('destination', cleanNumber);
  formData.append('message', JSON.stringify({ type: 'text', text: messageText }));
  if (appName) formData.append('src.name', appName);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      apikey: key,
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[Gupshup WhatsApp Error]', errText);
    throw new Error(`Gupshup send failed: ${errText}`);
  }

  const json = await response.json();
  return { success: true, messageId: json.messageId || `gup_${Date.now()}` };
}
