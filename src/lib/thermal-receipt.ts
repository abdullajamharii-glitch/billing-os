export interface ReceiptItem {
  name: string;
  barcode?: string;
  quantity: number;
  unit: string;
  price: number; // in rupees
  total: number; // in rupees
  taxRate?: number; // in percent e.g. 5 or 18
}

export interface ShopReceiptData {
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
  gstin?: string;
  billNumber: string;
  date: string;
  cashierName?: string;
  customerName?: string;
  customerPhone?: string;
  items: ReceiptItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  paymentMethod: string;
  cashReceived?: number;
  changeReturned?: number;
  receiptFooter?: string;
  pointsEarned?: number;
  pointsRedeemed?: number;
  loyaltyBalance?: number;
}

export class ThermalReceiptEngine {
  private static center(text: string, width: number): string {
    if (text.length >= width) return text.substring(0, width);
    const leftPad = Math.floor((width - text.length) / 2);
    return ' '.repeat(leftPad) + text;
  }

  private static justify(left: string, right: string, width: number): string {
    const space = width - left.length - right.length;
    if (space <= 0) return (left + ' ' + right).substring(0, width);
    return left + ' '.repeat(space) + right;
  }

  public static generateHtml(data: ShopReceiptData, paperWidth: '80mm' | '58mm' = '80mm'): string {
    const is80 = paperWidth === '80mm';
    const maxWidth = is80 ? '78mm' : '56mm';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt - ${data.billNumber}</title>
  <style>
    @media print {
      @page { margin: 0; size: ${paperWidth} auto; }
      body { margin: 0; padding: 6px; }
      .no-print { display: none !important; }
    }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: ${is80 ? '12px' : '10px'};
      line-height: 1.35;
      color: #000;
      max-width: ${maxWidth};
      margin: 0 auto;
      padding: 10px;
      background: #fff;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .double-divider { border-top: 2px solid #000; margin: 6px 0; }
    .flex-between { display: flex; justify-content: space-between; }
    table { width: 100%; border-collapse: collapse; font-size: inherit; }
    th { text-align: left; padding: 2px 0; border-bottom: 1px dashed #000; font-size: 10px; }
    td { padding: 2px 0; vertical-align: top; }
  </style>
</head>
<body>
  <div class="text-center">
    <div class="font-bold" style="font-size: ${is80 ? '16px' : '13px'};">${data.shopName}</div>
    ${data.shopAddress ? `<div>${data.shopAddress}</div>` : ''}
    ${data.shopPhone ? `<div>Tel: ${data.shopPhone}</div>` : ''}
    ${data.gstin ? `<div class="font-bold">GSTIN: ${data.gstin}</div>` : ''}
  </div>

  <div class="divider"></div>

  <div class="flex-between">
    <span>Bill: <span class="font-bold">${data.billNumber}</span></span>
    <span>${data.date}</span>
  </div>
  ${data.cashierName ? `<div>Cashier: ${data.cashierName}</div>` : ''}
  ${data.customerName && data.customerName !== 'Walk-in Customer' ? `<div>Customer: ${data.customerName} ${data.customerPhone ? `(${data.customerPhone})` : ''}</div>` : ''}

  <div class="divider"></div>

  <table>
    <thead>
      <tr>
        <th style="width: 50%;">ITEM</th>
        <th class="text-right" style="width: 15%;">QTY</th>
        <th class="text-right" style="width: 15%;">RATE</th>
        <th class="text-right" style="width: 20%;">TOTAL</th>
      </tr>
    </thead>
    <tbody>
      ${data.items
        .map(
          (item) => `
        <tr>
          <td>${item.name}</td>
          <td class="text-right">${item.quantity} ${item.unit}</td>
          <td class="text-right">₹${item.price.toFixed(2)}</td>
          <td class="text-right font-bold">₹${item.total.toFixed(2)}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <div class="divider"></div>

  <div class="flex-between">
    <span>Subtotal:</span>
    <span>₹${data.subtotal.toFixed(2)}</span>
  </div>
  ${
    data.discountTotal > 0
      ? `
  <div class="flex-between">
    <span>Discount:</span>
    <span>-₹${data.discountTotal.toFixed(2)}</span>
  </div>`
      : ''
  }
  ${
    data.taxTotal > 0
      ? `
  <div class="flex-between" style="font-size: ${is80 ? '11px' : '9px'}; color: #444;">
    <span>CGST (2.5%):</span>
    <span>₹${(data.taxTotal / 2).toFixed(2)}</span>
  </div>
  <div class="flex-between" style="font-size: ${is80 ? '11px' : '9px'}; color: #444;">
    <span>SGST (2.5%):</span>
    <span>₹${(data.taxTotal / 2).toFixed(2)}</span>
  </div>
  <div class="flex-between font-bold">
    <span>Total GST (5%):</span>
    <span>₹${data.taxTotal.toFixed(2)}</span>
  </div>`
      : ''
  }

  <div class="double-divider"></div>

  <div class="flex-between font-bold" style="font-size: ${is80 ? '15px' : '13px'};">
    <span>GRAND TOTAL:</span>
    <span>₹${data.grandTotal.toFixed(2)}</span>
  </div>

  <div class="divider"></div>

  <div class="flex-between">
    <span>Payment:</span>
    <span class="font-bold">${data.paymentMethod}</span>
  </div>
  ${
    data.paymentMethod === 'CASH' && data.cashReceived
      ? `
  <div class="flex-between">
    <span>Cash Received:</span>
    <span>₹${data.cashReceived.toFixed(2)}</span>
  </div>
  <div class="flex-between">
    <span>Change Returned:</span>
    <span class="font-bold">₹${(data.changeReturned || 0).toFixed(2)}</span>
  </div>`
      : ''
  }

  <div class="divider"></div>

  ${
    (data.pointsEarned && data.pointsEarned > 0) || (data.pointsRedeemed && data.pointsRedeemed > 0)
      ? `
  <div class="text-center" style="font-size: ${is80 ? '11px' : '9px'};">
    ${data.pointsEarned ? `<div class="font-bold">★ Loyalty Points Earned: +${data.pointsEarned} pts ★</div>` : ''}
    ${data.pointsRedeemed ? `<div>Points Redeemed: -${data.pointsRedeemed} pts</div>` : ''}
    ${data.loyaltyBalance !== undefined ? `<div class="font-bold">Total Loyalty Balance: ${data.loyaltyBalance} pts</div>` : ''}
  </div>
  <div class="divider"></div>`
      : ''
  }

  <div class="text-center" style="font-size: ${is80 ? '10px' : '9px'}; white-space: pre-line; margin-top: 6px;">
    ${data.receiptFooter || 'Thank you for your visit!\nPlease come again.'}
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
    `.trim();
  }
}
