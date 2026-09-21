/**
 * Formats structured digital receipts for WhatsApp & SMS
 */

export function formatWhatsAppReceipt(sale: any, org: any): string {
  const shopName = org?.name || 'FRIED ZONE';
  const shopPhone = org?.phone ? ` | Tel: ${org.phone}` : '';
  const dateStr = new Date(sale.createdAt || Date.now()).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const lines = [
    `🧾 *${shopName.toUpperCase()}*`,
    `----------------------------------------`,
    `*Bill No:* #${sale.billNumber}`,
    `*Date:* ${dateStr}`,
  ];

  if (org?.gstin) {
    lines.push(`*GSTIN:* ${org.gstin}`);
  }

  if (sale.customerName && sale.customerName !== 'Walk-in Customer') {
    lines.push(`*Customer:* ${sale.customerName}`);
  }

  lines.push(`----------------------------------------`);
  lines.push(`*ORDER ITEMS:*`);

  for (const item of sale.items || []) {
    const qty = `${item.quantity} ${item.unit || 'pcs'}`;
    const lineTotalRupees = ((item.lineTotal || 0) / 100).toFixed(2);
    lines.push(`• *${item.productName}* (${qty}) - ₹${lineTotalRupees}`);
  }

  lines.push(`----------------------------------------`);
  lines.push(`Subtotal: ₹${((sale.subtotal || 0) / 100).toFixed(2)}`);

  if (sale.discountTotal > 0) {
    lines.push(`Discount: -₹${((sale.discountTotal || 0) / 100).toFixed(2)}`);
  }

  const taxTotal = sale.taxTotal || 0;
  if (taxTotal > 0) {
    const halfTax = Math.round(taxTotal / 2);
    lines.push(`CGST (2.5%): ₹${(halfTax / 100).toFixed(2)}`);
    lines.push(`SGST (2.5%): ₹${((taxTotal - halfTax) / 100).toFixed(2)}`);
  }

  lines.push(`*GRAND TOTAL: ₹${((sale.total || 0) / 100).toFixed(2)}*`);
  lines.push(`Payment: *${sale.paymentMethod || 'CASH'}*`);

  if (sale.pointsEarned > 0 || sale.pointsRedeemed > 0) {
    lines.push(`----------------------------------------`);
    lines.push(`🎁 *LOYALTY REWARDS:*`);
    if (sale.pointsEarned > 0) {
      lines.push(`★ Points Earned: *+${sale.pointsEarned} pts*`);
    }
    if (sale.pointsRedeemed > 0) {
      lines.push(`Points Redeemed: -${sale.pointsRedeemed} pts`);
    }
    if (sale.customer?.loyaltyPoints !== undefined) {
      lines.push(`Total Points Balance: *${sale.customer.loyaltyPoints} pts*`);
    }
  }

  lines.push(`----------------------------------------`);
  lines.push(`${org?.receiptFooter || 'Thank you for your visit! Please come again.'}${shopPhone}`);

  return lines.join('\n');
}

export function formatSmsReceipt(sale: any, org: any): string {
  const shopName = org?.name || 'Fried Zone';
  const totalRupees = ((sale.total || 0) / 100).toFixed(2);
  let text = `Thanks for visiting ${shopName}! Bill #${sale.billNumber} for Rs.${totalRupees} is paid via ${sale.paymentMethod}.`;
  if (sale.pointsEarned > 0) {
    text += ` You earned +${sale.pointsEarned} loyalty pts!`;
  }
  return text;
}
