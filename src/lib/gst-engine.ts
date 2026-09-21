/**
 * Indian GST Statutory Engine & GSTR-1 Summary Calculator
 * Rule 46 Compliance for Restaurant & Retail POS Invoicing
 */

export interface GstSplit {
  taxableValue: number; // in paise
  cgstRate: number;     // in basis points (e.g. 250 = 2.5%)
  sgstRate: number;     // in basis points (e.g. 250 = 2.5%)
  igstRate: number;     // in basis points (e.g. 500 = 5.0%)
  cgstAmount: number;   // in paise
  sgstAmount: number;   // in paise
  igstAmount: number;   // in paise
  totalTax: number;     // in paise
}

/**
 * Extract 2-digit state code from 15-digit Indian GSTIN
 */
export function extractStateCodeFromGstin(gstin?: string | null): string | null {
  if (!gstin) return null;
  const clean = gstin.trim().toUpperCase();
  if (clean.length === 15 && /^\d{2}/.test(clean)) {
    return clean.substring(0, 2);
  }
  return null;
}

/**
 * Compute statutory CGST, SGST, IGST split
 */
export function calculateGstSplit({
  taxableValue,
  totalTaxRateBps,
  supplierGstin,
  customerGstin,
}: {
  taxableValue: number;
  totalTaxRateBps: number;
  supplierGstin?: string | null;
  customerGstin?: string | null;
}): GstSplit {
  const supplierState = extractStateCodeFromGstin(supplierGstin);
  const customerState = extractStateCodeFromGstin(customerGstin);

  // If customer has a GSTIN from a DIFFERENT state, it's an inter-state sale -> IGST
  const isInterState = customerState && supplierState && customerState !== supplierState;

  const totalTax = Math.round((taxableValue * totalTaxRateBps) / 10000);

  if (isInterState) {
    return {
      taxableValue,
      cgstRate: 0,
      sgstRate: 0,
      igstRate: totalTaxRateBps,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: totalTax,
      totalTax,
    };
  }

  // Intra-state (Standard for local restaurants / dining / retail)
  const halfRate = Math.round(totalTaxRateBps / 2);
  const halfTax = Math.round(totalTax / 2);
  const otherHalf = totalTax - halfTax;

  return {
    taxableValue,
    cgstRate: halfRate,
    sgstRate: totalTaxRateBps - halfRate,
    igstRate: 0,
    cgstAmount: halfTax,
    sgstAmount: otherHalf,
    igstAmount: 0,
    totalTax,
  };
}

/**
 * Generates GSTR-1 Outward Supply tables from sales list
 */
export function buildGstr1Summary(sales: any[], supplierGstin?: string | null) {
  let totalInvoices = 0;
  let totalGrossValue = 0;
  let totalTaxableValue = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  const b2bInvoices: any[] = [];
  const b2cInvoices: any[] = [];
  const hsnSummaryMap = new Map<string, {
    hsnCode: string;
    description: string;
    uqc: string;
    totalQty: number;
    totalValue: number;
    taxableValue: number;
    cgst: number;
    sgst: number;
    igst: number;
    totalTax: number;
  }>();

  for (const sale of sales) {
    totalInvoices++;
    totalGrossValue += sale.total || 0;
    const saleTaxable = Math.max(0, (sale.subtotal || 0) - (sale.discountTotal || 0));
    totalTaxableValue += saleTaxable;
    totalCgst += sale.cgstTotal || 0;
    totalSgst += sale.sgstTotal || 0;
    totalIgst += sale.igstTotal || 0;

    const hasCustomerGstin = sale.customer?.gstin && sale.customer.gstin.trim().length === 15;

    if (hasCustomerGstin) {
      b2bInvoices.push({
        billNumber: sale.billNumber,
        date: sale.createdAt,
        customerName: sale.customerName,
        customerGstin: sale.customer.gstin,
        totalValue: sale.total,
        taxableValue: saleTaxable,
        cgst: sale.cgstTotal,
        sgst: sale.sgstTotal,
        igst: sale.igstTotal,
      });
    } else {
      b2cInvoices.push(sale);
    }

    // Process items for HSN Table 12
    for (const it of sale.items || []) {
      const hsn = it.hsnCode || '996331';
      const existing = hsnSummaryMap.get(hsn) || {
        hsnCode: hsn,
        description: hsn === '996331' ? 'Restaurant Food & Beverage Services' : 'Supply of Goods',
        uqc: it.unit || 'NOS',
        totalQty: 0,
        totalValue: 0,
        taxableValue: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalTax: 0,
      };

      existing.totalQty += Number(it.quantity || 1);
      existing.totalValue += it.lineTotal || 0;
      const itTax = it.taxAmount || 0;
      existing.taxableValue += Math.max(0, (it.lineTotal || 0) - itTax);
      const halfTax = Math.round(itTax / 2);
      existing.cgst += halfTax;
      existing.sgst += itTax - halfTax;
      existing.totalTax += itTax;

      hsnSummaryMap.set(hsn, existing);
    }
  }

  return {
    metrics: {
      totalInvoices,
      totalGrossValue,
      totalTaxableValue,
      totalCgst,
      totalSgst,
      totalIgst,
      totalTax: totalCgst + totalSgst + totalIgst,
    },
    b2bCount: b2bInvoices.length,
    b2cCount: b2cInvoices.length,
    b2bInvoices,
    hsnTable: Array.from(hsnSummaryMap.values()),
  };
}
