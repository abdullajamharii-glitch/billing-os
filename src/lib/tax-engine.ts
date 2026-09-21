import { calculateTax } from './money';

export interface TaxBreakdown {
  taxClassId?: string;
  taxClassName?: string;
  rateBps: number;
  taxAmount: number; // in paise
  components?: Record<string, number>; // e.g. { CGST: 900, SGST: 900 }
  componentAmounts?: Record<string, number>; // e.g. { CGST: 9000, SGST: 9000 }
}

export interface CalculatedItem {
  description: string;
  quantity: number;
  unitPrice: number; // paise
  taxClassId?: string;
  subtotal: number; // paise = quantity * unitPrice
  taxAmount: number; // paise
  lineTotal: number; // paise = subtotal + taxAmount
}

/**
 * Calculate totals and tax amounts for an item line
 */
export function calculateLineItem(
  description: string,
  quantity: number,
  unitPricePaise: number,
  taxRateBps: number = 0,
  taxClassId?: string
): CalculatedItem {
  const subtotal = Math.max(0, Math.round(quantity * unitPricePaise));
  const taxAmount = calculateTax(subtotal, taxRateBps);
  const lineTotal = subtotal + taxAmount;

  return {
    description,
    quantity,
    unitPrice: unitPricePaise,
    taxClassId,
    subtotal,
    taxAmount,
    lineTotal,
  };
}

/**
 * Calculate totals for a whole invoice
 */
export function calculateInvoiceTotals(items: Array<{ quantity: number; unitPrice: number; taxRateBps?: number }>) {
  let subtotal = 0;
  let taxTotal = 0;

  for (const item of items) {
    const itemSub = Math.max(0, Math.round(item.quantity * item.unitPrice));
    const itemTax = calculateTax(itemSub, item.taxRateBps ?? 0);
    subtotal += itemSub;
    taxTotal += itemTax;
  }

  const total = subtotal + taxTotal;
  return { subtotal, taxTotal, total };
}
