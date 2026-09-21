/**
 * SMS Gateway Client (Fast2SMS / MSG91 / Generic Webhook)
 */

export interface SmsConfig {
  apiKey?: string;
  senderId?: string;
  recipientPhone: string;
  messageText: string;
}

export async function sendSmsMessage({
  apiKey,
  recipientPhone,
  messageText,
}: SmsConfig): Promise<{ success: boolean; messageId?: string }> {
  const key = apiKey || process.env.FAST2SMS_API_KEY || process.env.SMS_API_KEY;

  if (!key) {
    console.log('[SMS Simulation Mode]', { recipientPhone, messageText });
    return {
      success: true,
      messageId: `sim_sms_${Date.now()}`,
    };
  }

  const cleanNumber = recipientPhone.replace(/\D/g, '').slice(-10);

  // Fast2SMS Quick SMS endpoint for India
  const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: {
      authorization: key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      route: 'q',
      message: messageText,
      language: 'english',
      flash: 0,
      numbers: cleanNumber,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[SMS Error]', errText);
    throw new Error(`SMS send failed: ${errText}`);
  }

  const json = await response.json();
  return { success: true, messageId: json.request_id || `sms_${Date.now()}` };
}
