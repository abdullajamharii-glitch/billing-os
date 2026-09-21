/**
 * Money utilities — all amounts stored as integers (paise/cents).
 * NEVER use floats for money calculations.
 */

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function formatCurrency(
  paise: number,
  currency: string = 'INR',
  locale: string = 'en-IN'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export function formatCurrencyCompact(
  paise: number,
  currency: string = 'INR'
): string {
  const amount = paise / 100;
  if (amount >= 10_00_000) return `₹${(amount / 10_00_000).toFixed(1)}L`;
  if (amount >= 1_000) return `₹${(amount / 1000).toFixed(1)}K`;
  return formatCurrency(paise, currency);
}

/**
 * Calculate tax amount in paise from a subtotal and rate in basis points.
 * e.g. subtotal=10000 paise, rate=1800 bps (18%) => taxAmount=1800 paise
 */
export function calculateTax(subtotalPaise: number, rateBps: number): number {
  return Math.round((subtotalPaise * rateBps) / 10000);
}

export function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(0)}%`;
}

/**
 * Split a GST rate into CGST + SGST or IGST depending on transaction type.
 * components: { CGST: 900, SGST: 900 } (intrastate) or { IGST: 1800 } (interstate)
 */
export function splitGst(
  subtotalPaise: number,
  components: Record<string, number>
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, bps] of Object.entries(components)) {
    result[key] = calculateTax(subtotalPaise, bps);
  }
  return result;
}
