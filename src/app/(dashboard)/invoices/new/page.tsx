'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Trash2,
  FileText,
  Calendar,
  User,
  Percent,
  CheckCircle,
  Save,
  Send,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, paiseToRupees, rupeesToPaise, bpsToPercent } from '@/lib/money';

interface Customer {
  id: string;
  name: string;
  email?: string;
  currency: string;
  creditTermsDays: number;
}

interface TaxClass {
  id: string;
  name: string;
  rate: number; // in basis points (1800 = 18%)
  type: string;
}

interface LineItemState {
  id: string;
  description: string;
  quantity: number;
  unitPriceRupees: string;
  taxClassId: string;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [taxClasses, setTaxClasses] = useState<TaxClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingMeta, setFetchingMeta] = useState(true);

  // Form State
  const [customerId, setCustomerId] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItemState[]>([
    {
      id: 'item-1',
      description: '',
      quantity: 1,
      unitPriceRupees: '',
      taxClassId: '',
    },
  ]);

  // Load initial customers and tax classes
  useEffect(() => {
    Promise.all([
      fetch('/api/v1/customers?pageSize=100').then((r) => r.json()),
      fetch('/api/v1/tax-classes').then((r) => r.json()),
    ])
      .then(([custJson, taxJson]) => {
        const custList: Customer[] = custJson.data ?? [];
        setCustomers(custList);
        const taxList: TaxClass[] = taxJson.data ?? [];
        setTaxClasses(taxList);

        // Pre-select 18% GST if available
        const defaultTax = taxList.find((t) => t.rate === 1800) ?? taxList[0];
        if (defaultTax) {
          setItems([
            {
              id: 'item-1',
              description: '',
              quantity: 1,
              unitPriceRupees: '',
              taxClassId: defaultTax.id,
            },
          ]);
        }

        // Set default customer
        if (custList.length > 0) {
          const first = custList[0];
          setCustomerId(first.id);
          // Set due date based on credit terms
          const due = new Date();
          due.setDate(due.getDate() + (first.creditTermsDays || 30));
          setDueDate(due.toISOString().split('T')[0]);
        }
      })
      .finally(() => setFetchingMeta(false));
  }, []);

  // Update due date when customer changes
  const handleCustomerChange = (newCustId: string) => {
    setCustomerId(newCustId);
    const cust = customers.find((c) => c.id === newCustId);
    if (cust && issueDate) {
      const issue = new Date(issueDate);
      issue.setDate(issue.getDate() + (cust.creditTermsDays || 30));
      setDueDate(issue.toISOString().split('T')[0]);
    }
  };

  // Line item handlers
  const addItem = () => {
    const defaultTaxId = taxClasses.find((t) => t.rate === 1800)?.id ?? taxClasses[0]?.id ?? '';
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        description: '',
        quantity: 1,
        unitPriceRupees: '',
        taxClassId: defaultTaxId,
      },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, field: keyof LineItemState, value: any) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Calculations
  const taxMap = new Map(taxClasses.map((t) => [t.id, t.rate]));

  const computedLines = items.map((item) => {
    const qty = Math.max(1, Number(item.quantity) || 1);
    const unitPriceRupees = parseFloat(item.unitPriceRupees) || 0;
    const unitPricePaise = rupeesToPaise(unitPriceRupees);
    const lineSubtotalPaise = qty * unitPricePaise;
    const rateBps = item.taxClassId ? taxMap.get(item.taxClassId) ?? 0 : 0;
    const lineTaxPaise = Math.round((lineSubtotalPaise * rateBps) / 10000);
    const lineTotalPaise = lineSubtotalPaise + lineTaxPaise;

    return {
      ...item,
      qty,
      unitPricePaise,
      lineSubtotalPaise,
      lineTaxPaise,
      lineTotalPaise,
      rateBps,
    };
  });

  const subtotalPaise = computedLines.reduce((acc, i) => acc + i.lineSubtotalPaise, 0);
  const taxTotalPaise = computedLines.reduce((acc, i) => acc + i.lineTaxPaise, 0);
  const totalPaise = subtotalPaise + taxTotalPaise;

  const handleSubmit = async (submitStatus: 'DRAFT' | 'SENT') => {
    if (!customerId) {
      toast.error('Please select a customer');
      return;
    }
    if (!dueDate) {
      toast.error('Please set a due date');
      return;
    }

    const invalidItems = items.filter((i) => !i.description.trim() || !(parseFloat(i.unitPriceRupees) > 0));
    if (invalidItems.length > 0) {
      toast.error('Please provide valid descriptions and unit prices for all items');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        customerId,
        issueDate: issueDate ? new Date(issueDate).toISOString() : new Date().toISOString(),
        dueDate: new Date(dueDate).toISOString(),
        notes: notes.trim() || undefined,
        status: submitStatus,
        items: items.map((item) => ({
          description: item.description.trim(),
          quantity: Math.max(1, Number(item.quantity) || 1),
          unitPrice: rupeesToPaise(parseFloat(item.unitPriceRupees) || 0),
          taxClassId: item.taxClassId || undefined,
        })),
      };

      const res = await fetch('/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(
          submitStatus === 'SENT'
            ? `Invoice ${json.data.invoiceNumber} created & issued!`
            : `Draft ${json.data.invoiceNumber} saved!`
        );
        router.push(`/invoices/${json.data.id}`);
      } else {
        toast.error(json.error ?? 'Failed to create invoice');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-light pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/invoices"
            className="text-stone-400 hover:text-stone-700 transition-colors p-1.5 rounded-lg hover:bg-white"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-display font-bold text-stone-800">New Invoice</h1>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              Create and issue a professional invoice
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleSubmit('DRAFT')}
            disabled={loading}
            className="bg-white border border-border-light hover:bg-stone-50 text-stone-700 text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-60 shadow-xs cursor-pointer"
          >
            <Save size={14} /> Save Draft
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('SENT')}
            disabled={loading}
            className="bg-brand hover:bg-brand-dark text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-60 shadow-sm cursor-pointer"
          >
            {loading ? (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={14} />
            )}
            Issue Invoice
          </button>
        </div>
      </header>

      {fetchingMeta ? (
        <div className="bg-panel border border-border-light rounded-xl p-12 text-center text-stone-400 text-sm shadow-xs">
          Loading invoice workspace...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Config Card */}
          <div className="bg-panel border border-border-light rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="font-semibold text-stone-800 text-sm flex items-center gap-2">
              <User size={15} className="text-brand" /> Invoice Recipient &amp; Dates
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Customer */}
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                  Customer <span className="text-brand">*</span>
                </label>
                {customers.length === 0 ? (
                  <div className="p-2 border border-red-200 bg-red-50 text-red-600 text-xs rounded-lg">
                    No customers found.{' '}
                    <Link href="/customers/new" className="underline font-bold">
                      Create one first
                    </Link>
                  </div>
                ) : (
                  <select
                    value={customerId}
                    onChange={(e) => handleCustomerChange(e.target.value)}
                    className="w-full bg-white border border-border-light rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand/40 transition-colors shadow-xs"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.currency})
                      </option>
                    ))}
                  </select>
                )}
                {selectedCustomer && (
                  <span className="text-[10px] text-stone-500 mt-1 block">
                    Credit terms: Net {selectedCustomer.creditTermsDays} days
                  </span>
                )}
              </div>

              {/* Issue Date */}
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                  Issue Date <span className="text-brand">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full bg-white border border-border-light rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand/40 transition-colors shadow-xs"
                  />
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                  Due Date <span className="text-brand">*</span>
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-white border border-border-light rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand/40 transition-colors shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* Line Items Card */}
          <div className="bg-panel border border-border-light rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-stone-800 text-sm flex items-center gap-2">
                <FileText size={15} className="text-brand" /> Line Items
              </h3>
              <span className="text-xs text-stone-500 font-medium">
                {items.length} item{items.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                <thead>
                  <tr className="bg-stone-50 text-stone-400 font-semibold border-b border-border-light">
                    <th className="p-3 w-1/2">DESCRIPTION</th>
                    <th className="p-3 w-20 text-center">QTY</th>
                    <th className="p-3 w-32 text-right">UNIT PRICE (₹)</th>
                    <th className="p-3 w-32">TAX</th>
                    <th className="p-3 w-28 text-right">TOTAL</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {computedLines.map((item, index) => (
                    <tr key={item.id} className="hover:bg-stone-50/40 transition-colors">
                      <td className="p-3">
                        <input
                          type="text"
                          placeholder="e.g. Monthly Software Retainer / Consulting Services"
                          value={item.description}
                          onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                          className="w-full bg-white border border-border-light rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-brand/40 transition-colors"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)
                          }
                          className="w-full bg-white border border-border-light rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:border-brand/40 transition-colors"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder="0.00"
                          value={item.unitPriceRupees}
                          onChange={(e) => updateItem(item.id, 'unitPriceRupees', e.target.value)}
                          className="w-full bg-white border border-border-light rounded-lg px-3 py-1.5 text-xs text-right focus:outline-none focus:border-brand/40 transition-colors"
                        />
                      </td>
                      <td className="p-3">
                        <select
                          value={item.taxClassId}
                          onChange={(e) => updateItem(item.id, 'taxClassId', e.target.value)}
                          className="w-full bg-white border border-border-light rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-brand/40 transition-colors"
                        >
                          <option value="">No Tax (0%)</option>
                          {taxClasses.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({bpsToPercent(t.rate)})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3 text-right font-bold text-stone-800">
                        {formatCurrency(item.lineTotalPaise)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          disabled={items.length <= 1}
                          className="text-stone-300 hover:text-red-500 disabled:opacity-20 transition-colors p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={addItem}
              className="mt-2 text-brand hover:text-brand-dark text-xs font-semibold flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-light hover:bg-brand/15 transition-colors cursor-pointer"
            >
              <Plus size={14} /> Add Line Item
            </button>
          </div>

          {/* Bottom Section: Notes & Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Notes */}
            <div className="bg-panel border border-border-light rounded-xl p-5 shadow-xs space-y-3">
              <h3 className="font-semibold text-stone-800 text-sm">Notes &amp; Payment Instructions</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Bank transfer details, PO reference, or customer notes..."
                className="w-full bg-white border border-border-light rounded-lg p-3 text-xs focus:outline-none focus:border-brand/40 transition-colors resize-none leading-relaxed"
              />
            </div>

            {/* Summary Totals Box */}
            <div className="bg-panel border border-border-light rounded-xl p-5 shadow-xs space-y-3">
              <h3 className="font-semibold text-stone-800 text-sm">Invoice Summary</h3>

              <div className="space-y-2 text-xs border-b border-border-light pb-3">
                <div className="flex justify-between text-stone-600">
                  <span>Subtotal</span>
                  <span className="font-semibold">{formatCurrency(subtotalPaise)}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Tax Total</span>
                  <span className="font-semibold">{formatCurrency(taxTotalPaise)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-1">
                <div>
                  <span className="text-sm font-bold text-stone-800 block">Total Due</span>
                  <span className="text-[10px] text-stone-400">Sequential invoice number assigned upon save</span>
                </div>
                <span className="text-2xl font-extrabold text-brand tracking-tight">
                  {formatCurrency(totalPaise)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
