import crypto from 'crypto';
import QRCode from 'qrcode';
import { prisma } from './prisma';

export interface RazorpayConfig {
  isEnabled: boolean;
  keyId?: string | null;
  keySecret?: string | null;
  webhookSecret?: string | null;
  testMode?: boolean;
}

export async function getRazorpayConfig(orgId: string): Promise<RazorpayConfig> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { razorpayConfig: true, bankDetails: true, name: true },
  });

  const cfg = (org?.razorpayConfig as any) || {};
  return {
    isEnabled: cfg.isEnabled ?? Boolean(process.env.RAZORPAY_KEY_ID),
    keyId: cfg.keyId || process.env.RAZORPAY_KEY_ID || null,
    keySecret: cfg.keySecret || process.env.RAZORPAY_KEY_SECRET || null,
    webhookSecret: cfg.webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || null,
    testMode: cfg.testMode ?? (!process.env.RAZORPAY_KEY_ID && !cfg.keyId),
  };
}

export async function createRazorpayOrder({
  orgId,
  amountPaise,
  receiptId,
  notes,
}: {
  orgId: string;
  amountPaise: number;
  receiptId?: string;
  notes?: Record<string, string>;
}) {
  const [config, org] = await Promise.all([
    getRazorpayConfig(orgId),
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, bankDetails: true },
    }),
  ]);

  const shopName = org?.name || 'Fried Zone';
  const bankDetails = (org?.bankDetails as any) || {};
  const upiId = bankDetails.upiId || 'friedzone@upi';

  // If real credentials are provided, call Razorpay Orders API
  if (config.keyId && config.keySecret && !config.testMode) {
    const authHeader = 'Basic ' + Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: receiptId || `REC-${Date.now()}`,
        notes: notes || {},
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Razorpay Order Error]', errText);
      throw new Error(`Razorpay Order creation failed: ${response.statusText}`);
    }

    const order = await response.json();

    // Generate dynamic UPI Intent QR Code
    const amountRupees = (amountPaise / 100).toFixed(2);
    const upiIntent = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&am=${amountRupees}&tr=${encodeURIComponent(order.id)}&cu=INR&tn=${encodeURIComponent(`Bill payment ${shopName}`)}`;
    const qrCodeDataUrl = await QRCode.toDataURL(upiIntent, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 280,
      color: { dark: '#000000', light: '#ffffff' },
    });

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      qrCodeDataUrl,
      upiIntent,
      keyId: config.keyId,
      isTestMode: false,
    };
  }

  // Demo / Test Mode: Create simulated order and authentic UPI QR code
  const mockOrderId = `order_test_${Date.now()}`;
  const amountRupees = (amountPaise / 100).toFixed(2);
  const upiIntent = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&am=${amountRupees}&tr=${encodeURIComponent(mockOrderId)}&cu=INR&tn=${encodeURIComponent(`Bill payment ${shopName}`)}`;

  const qrCodeDataUrl = await QRCode.toDataURL(upiIntent, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 280,
    color: { dark: '#000000', light: '#ffffff' },
  });

  return {
    orderId: mockOrderId,
    amount: amountPaise,
    currency: 'INR',
    qrCodeDataUrl,
    upiIntent,
    keyId: config.keyId || 'rzp_test_mock_pos',
    isTestMode: true,
  };
}

export function verifyPaymentSignature({
  orderId,
  paymentId,
  signature,
  secret,
}: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret: string;
}): boolean {
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    return expected === signature;
  } catch {
    return false;
  }
}

export function verifyWebhookSignature({
  rawBody,
  signature,
  secret,
}: {
  rawBody: string;
  signature: string;
  secret: string;
}): boolean {
  try {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return expected === signature;
  } catch {
    return false;
  }
}
