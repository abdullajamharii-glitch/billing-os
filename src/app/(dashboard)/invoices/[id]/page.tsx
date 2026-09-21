'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Printer,
  Send,
  CreditCard,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  Ban,
  FileText,
  AlertCircle,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, paiseToRupees, rupeesToPaise, bpsToPercent } from '@/lib/money';

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  status: 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'VOID';
  issueDate: string;
  dueDate: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  paidAmount: number;
  currency: string;
  notes?: string;
  sentAt?: string;
  paidAt?: string;
  org: {
    name: string;
    gstin?: string;
    address?: any;
    bankDetails?: any;
  };
  customer: {
    name: string;
    email?: string;
    phone?: string;
    taxId?: string;
    billingAddress?: any;
  };
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxAmount: number;
    lineTotal: number;
    taxClass?: {
      name: string;
      rate: number;
    };
  }>;
  payments: Array<{
    id: string;
    amount: number;
    gateway: string;
    paidAt: string;
    createdAt: string;
  }>;
}

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: 'bg-stone-100', text: 'text-stone-600', label: 'Draft' },
  SENT: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Sent' },
  PARTIALLY_PAID: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Partially Paid' },
  PAID: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Paid in Full' },
  OVERDUE: { bg: 'bg-red-50', text: 'text-red-700', label: 'Overdue' },
  CANCELLED: { bg: 'bg-stone-100', text: 'text-stone-500', label: 'Cancelled' },
  VOID: { bg: 'bg-stone-100', text: 'text-stone-400', label: 'Void' },
};

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Record Payment Modal State
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmountRupees, setPayAmountRupees] = useState('');
  const [payGateway, setPayGateway] = useState<'MANUAL' | 'RAZORPAY' | 'STRIPE'>('MANUAL');
  const [payNotes, setPayNotes] = useState('');
  const [submittingPay, setSubmittingPay] = useState(false);

  const fetchInvoice = async () => {
    try {
      const res = await fetch(`/api/v1/invoices/${id}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setInvoice(json.data);
        const remainingRupees = paiseToRupees(json.data.total - json.data.paidAmount);
        setPayAmountRupees(remainingRupees > 0 ? String(remainingRupees) : '');
      } else {
        toast.error('Invoice not found');
        router.push('/invoices');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  // Actions
  const handleSend = async () => {
    try {
      const res = await fetch(`/api/v1/invoices/${id}/send`, { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        toast.success('Invoice marked as Sent!');
        fetchInvoice();
      } else {
        toast.error(json.error ?? 'Failed to send invoice');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const handleVoid = async () => {
    if (!confirm('Are you sure you want to VOID this invoice? This action is permanent.')) return;
    try {
      const res = await fetch(`/api/v1/invoices/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok) {
        toast.success('Invoice has been voided');
        fetchInvoice();
      } else {
        toast.error(json.error ?? 'Failed to void invoice');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const paise = rupeesToPaise(parseFloat(payAmountRupees) || 0);
    if (paise <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    setSubmittingPay(true);
    try {
      const res = await fetch(`/api/v1/invoices/${id}/record-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: paise,
          gateway: payGateway,
          notes: payNotes || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success('Payment recorded successfully!');
        setShowPayModal(false);
        fetchInvoice();
      } else {
        toast.error(json.error ?? 'Failed to record payment');
      }
    } finally {
      setSubmittingPay(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-stone-400 text-sm">Loading invoice details...</div>
    );
  }

  if (!invoice) return null;

  const badge = STATUS_BADGES[invoice.status] ?? {
    bg: 'bg-stone-100',
    text: 'text-stone-600',
    label: invoice.status,
  };
  const balanceDue = invoice.total - invoice.paidAmount;

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Top Navigation & Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-light pb-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/invoices"
            className="text-stone-400 hover:text-stone-700 transition-colors p-1.5 rounded-lg hover:bg-white"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-display font-bold text-stone-800">
                {invoice.invoiceNumber}
              </h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}
              >
                {badge.label}
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              Issued on {new Date(invoice.issueDate).toLocaleDateString('en-IN')}
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          {invoice.status === 'DRAFT' && (
            <button
              onClick={handleSend}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Send size={13} /> Issue &amp; Send
            </button>
          )}

          {balanceDue > 0 && invoice.status !== 'VOID' && invoice.status !== 'CANCELLED' && (
            <button
              onClick={() => setShowPayModal(true)}
              className="bg-brand hover:bg-brand-dark text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <CreditCard size={13} /> Record Payment
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="bg-white border border-border-light hover:bg-stone-50 text-stone-700 text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Printer size={13} /> Print
          </button>

          {invoice.status !== 'VOID' && invoice.status !== 'PAID' && (
            <button
              onClick={handleVoid}
              className="text-stone-400 hover:text-red-600 hover:bg-red-50 text-xs font-semibold p-2 rounded-xl transition-colors cursor-pointer"
              title="Void Invoice"
            >
              <Ban size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Main Printable Invoice Card */}
      <div className="bg-panel border border-border-light rounded-2xl shadow-xs p-8 space-y-8 print:border-none print:shadow-none print:p-0">
        {/* Invoice Header: Org Info vs Recipient */}
        <div className="flex flex-col sm:flex-row justify-between gap-6 border-b border-border-light pb-6">
          {/* Org (Issuer) */}
          <div className="space-y-1.5">
            <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center text-white font-bold text-sm shadow-xs mb-2">
              <Building2 size={20} />
            </div>
            <h2 className="font-display font-bold text-lg text-stone-800">
              {invoice.org.name}
            </h2>
            {invoice.org.gstin && (
              <p className="text-xs text-stone-500 font-medium">GSTIN: {invoice.org.gstin}</p>
            )}
            {invoice.org.address && (
              <p className="text-xs text-stone-500 leading-relaxed">
                {invoice.org.address.line1}, {invoice.org.address.city}, {invoice.org.address.state}{' '}
                {invoice.org.address.pincode}
              </p>
            )}
          </div>

          {/* Invoice Meta */}
          <div className="sm:text-right space-y-1">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">
              TAX INVOICE
            </span>
            <div className="text-xl font-display font-bold text-brand">
              {invoice.invoiceNumber}
            </div>
            <p className="text-xs text-stone-600 font-medium">
              Issue Date: {new Date(invoice.issueDate).toLocaleDateString('en-IN')}
            </p>
            <p className="text-xs text-stone-600 font-medium">
              Due Date:{' '}
              <span className="text-stone-800 font-semibold">
                {new Date(invoice.dueDate).toLocaleDateString('en-IN')}
              </span>
            </p>
          </div>
        </div>

        {/* Bill To */}
        <div className="bg-stone-50/70 border border-border-light rounded-xl p-4 space-y-1 max-w-sm">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
            BILLED TO
          </span>
          <h4 className="font-bold text-stone-800 text-sm">{invoice.customer.name}</h4>
          {invoice.customer.taxId && (
            <p className="text-xs text-stone-500">GST / Tax ID: {invoice.customer.taxId}</p>
          )}
          {invoice.customer.email && (
            <p className="text-xs text-stone-500">{invoice.customer.email}</p>
          )}
          {invoice.customer.billingAddress && (
            <p className="text-xs text-stone-500 leading-relaxed">
              {invoice.customer.billingAddress.line1}, {invoice.customer.billingAddress.city},{' '}
              {invoice.customer.billingAddress.state} {invoice.customer.billingAddress.pincode}
            </p>
          )}
        </div>

        {/* Line Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50 text-stone-400 font-semibold border-b border-border-light">
                <th className="p-3">#</th>
                <th className="p-3">DESCRIPTION</th>
                <th className="p-3 text-center">QTY</th>
                <th className="p-3 text-right">UNIT PRICE</th>
                <th className="p-3 text-right">TAX</th>
                <th className="p-3 text-right">TOTAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {invoice.items.map((item, index) => (
                <tr key={item.id} className="hover:bg-stone-50/40">
                  <td className="p-3 text-stone-400 font-mono">{index + 1}</td>
                  <td className="p-3 font-semibold text-stone-800">{item.description}</td>
                  <td className="p-3 text-center text-stone-600">{item.quantity}</td>
                  <td className="p-3 text-right text-stone-600">
                    {formatCurrency(item.unitPrice, invoice.currency)}
                  </td>
                  <td className="p-3 text-right text-stone-500">
                    {formatCurrency(item.taxAmount, invoice.currency)}
                    {item.taxClass && (
                      <span className="block text-[9px] text-stone-400">
                        {bpsToPercent(item.taxClass.rate)}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right font-bold text-stone-800">
                    {formatCurrency(item.lineTotal, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Breakdown */}
        <div className="flex flex-col sm:flex-row justify-between gap-6 pt-4 border-t border-border-light">
          {/* Notes & Bank Details */}
          <div className="space-y-4 max-w-sm text-xs text-stone-500">
            {invoice.notes && (
              <div>
                <span className="font-bold text-stone-700 block mb-0.5">Notes:</span>
                <p className="leading-relaxed whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}
            {invoice.org.bankDetails && (
              <div className="bg-stone-50 border border-border-light rounded-lg p-3 space-y-1">
                <span className="font-bold text-stone-700 block text-[11px]">Bank Transfer Details</span>
                <p className="text-[11px] text-stone-600">Bank: {invoice.org.bankDetails.bankName}</p>
                <p className="text-[11px] text-stone-600">A/C: {invoice.org.bankDetails.accountNumber}</p>
                <p className="text-[11px] text-stone-600">IFSC: {invoice.org.bankDetails.ifsc}</p>
              </div>
            )}
          </div>

          {/* Numbers Box */}
          <div className="w-full sm:w-72 space-y-2 text-xs">
            <div className="flex justify-between text-stone-600">
              <span>Subtotal</span>
              <span className="font-semibold">
                {formatCurrency(invoice.subtotal, invoice.currency)}
              </span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>Tax Total</span>
              <span className="font-semibold">
                {formatCurrency(invoice.taxTotal, invoice.currency)}
              </span>
            </div>
            <div className="flex justify-between text-stone-800 font-bold text-sm border-t border-border-light pt-2">
              <span>Invoice Total</span>
              <span>{formatCurrency(invoice.total, invoice.currency)}</span>
            </div>
            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>Paid Amount</span>
              <span>- {formatCurrency(invoice.paidAmount, invoice.currency)}</span>
            </div>
            <div className="flex justify-between items-center bg-stone-100 p-2 rounded-lg font-bold text-stone-900 text-sm">
              <span>Balance Due</span>
              <span className={balanceDue > 0 ? 'text-status-danger' : 'text-emerald-700'}>
                {formatCurrency(balanceDue, invoice.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Payment History Log */}
        {invoice.payments && invoice.payments.length > 0 && (
          <div className="border-t border-border-light pt-6 space-y-3 print:hidden">
            <h4 className="font-semibold text-stone-800 text-xs">Recorded Payments</h4>
            <div className="space-y-1.5">
              {invoice.payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between bg-emerald-50/50 border border-emerald-100 rounded-lg px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle size={13} className="text-emerald-600 shrink-0" />
                    <span className="font-semibold text-stone-800">
                      {formatCurrency(p.amount, invoice.currency)}
                    </span>
                    <span className="text-stone-400">• {p.gateway}</span>
                  </div>
                  <span className="text-[11px] text-stone-500">
                    {new Date(p.paidAt || p.createdAt).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-panel border border-border-light rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border-light pb-3">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-brand" />
                <h3 className="font-bold text-stone-800 text-base">Record Payment</h3>
              </div>
              <button
                onClick={() => setShowPayModal(false)}
                className="text-stone-400 hover:text-stone-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  Amount (₹) <span className="text-brand">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  max={paiseToRupees(balanceDue)}
                  value={payAmountRupees}
                  onChange={(e) => setPayAmountRupees(e.target.value)}
                  className="w-full border border-border-light rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand/40 bg-white"
                  placeholder="0.00"
                  required
                />
                <span className="text-[10px] text-stone-400 mt-1 block">
                  Remaining balance: {formatCurrency(balanceDue, invoice.currency)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  Payment Method
                </label>
                <select
                  value={payGateway}
                  onChange={(e) => setPayGateway(e.target.value as any)}
                  className="w-full border border-border-light rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand/40 bg-white"
                >
                  <option value="MANUAL">Cash / Direct Bank Transfer (Manual)</option>
                  <option value="RAZORPAY">Razorpay</option>
                  <option value="STRIPE">Stripe</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Notes</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full border border-border-light rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand/40 bg-white"
                  placeholder="Reference number / UTR / Cheque number..."
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  disabled={submittingPay}
                  className="flex-1 bg-brand hover:bg-brand-dark text-white text-xs font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer shadow-sm"
                >
                  {submittingPay ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <CheckCircle size={13} />
                  )}
                  Confirm Payment
                </button>
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="border border-border-light text-stone-600 hover:bg-stone-50 text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
