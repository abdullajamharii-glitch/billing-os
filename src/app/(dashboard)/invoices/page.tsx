'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  Plus,
  ArrowRight,
  FileText,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Receipt,
  Download,
} from 'lucide-react';
import { formatCurrency } from '@/lib/money';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface Invoice {
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
  customer?: {
    id: string;
    name: string;
    email?: string;
  };
}

const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Unpaid', value: 'UNPAID' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Sent', value: 'SENT' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Overdue', value: 'OVERDUE' },
];

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: 'bg-stone-100', text: 'text-stone-600', label: 'Draft' },
  SENT: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Sent' },
  PARTIALLY_PAID: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Partially Paid' },
  PAID: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Paid' },
  OVERDUE: { bg: 'bg-red-50', text: 'text-red-700', label: 'Overdue' },
  CANCELLED: { bg: 'bg-stone-100', text: 'text-stone-500', label: 'Cancelled' },
  VOID: { bg: 'bg-stone-100', text: 'text-stone-400', label: 'Void' },
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: '50' });
      if (search) params.set('search', search);
      if (selectedStatus && selectedStatus !== 'UNPAID') {
        params.set('status', selectedStatus);
      }
      const res = await fetch(`/api/v1/invoices?${params}`);
      const json = await res.json();
      let list: Invoice[] = json.data ?? [];

      if (selectedStatus === 'UNPAID') {
        list = list.filter((i) => ['SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(i.status));
      }

      setInvoices(list);
      setTotalCount(json.meta?.total ?? list.length);
    } finally {
      setLoading(false);
    }
  }, [search, selectedStatus]);

  useEffect(() => {
    const t = setTimeout(fetchInvoices, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchInvoices]);

  // Aggregate stats
  const totalBilled = invoices.reduce((acc, i) => acc + i.total, 0);
  const totalOutstanding = invoices
    .filter((i) => ['SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(i.status))
    .reduce((acc, i) => acc + (i.total - i.paidAmount), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-light pb-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-stone-800">Invoices</h1>
          <p className="text-xs text-stone-500 font-medium mt-1">
            Manage billing, issue invoices, and track incoming payments
          </p>
        </div>
        <Link
          href="/invoices/new"
          className="bg-brand hover:bg-brand-dark text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors shadow-sm self-start sm:self-auto cursor-pointer"
        >
          <Plus size={14} /> New Invoice
        </Link>
      </header>

      {/* Quick Status Tabs + Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-stone-200/60 p-1 rounded-xl w-fit">
          {STATUS_TABS.map((tab) => {
            const active = selectedStatus === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setSelectedStatus(tab.value)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  active
                    ? 'bg-white text-stone-800 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search invoice or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-panel border border-border-light rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-brand/40 transition-colors shadow-xs"
          />
        </div>
      </div>

      {/* Invoice Table */}
      <div className="bg-panel border border-border-light rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50 text-stone-400 font-semibold border-b border-border-light">
                <th className="p-3">INVOICE</th>
                <th className="p-3">CUSTOMER</th>
                <th className="p-3">ISSUE DATE</th>
                <th className="p-3">DUE DATE</th>
                <th className="p-3 text-right">TOTAL</th>
                <th className="p-3 text-right">BALANCE DUE</th>
                <th className="p-3 text-center">STATUS</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-stone-400">
                    Loading invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <FileText size={32} className="mx-auto text-stone-200 mb-3" />
                    <p className="text-stone-500 font-medium text-sm">No invoices found</p>
                    <Link
                      href="/invoices/new"
                      className="text-brand text-xs font-semibold mt-2 inline-block hover:underline"
                    >
                      Create your first invoice →
                    </Link>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const badge = STATUS_BADGES[inv.status] ?? {
                    bg: 'bg-stone-100',
                    text: 'text-stone-600',
                    label: inv.status,
                  };
                  const balanceDue = inv.total - inv.paidAmount;

                  return (
                    <tr key={inv.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="p-3">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="font-bold text-brand hover:underline"
                        >
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="p-3">
                        <span className="font-semibold text-stone-800">
                          {inv.customer?.name ?? 'Unknown'}
                        </span>
                      </td>
                      <td className="p-3 text-stone-500">
                        {new Date(inv.issueDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="p-3 text-stone-500">
                        {new Date(inv.dueDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="p-3 text-right font-bold text-stone-800">
                        {formatCurrency(inv.total, inv.currency)}
                      </td>
                      <td className="p-3 text-right font-medium">
                        {balanceDue > 0 ? (
                          <span className="text-status-danger font-semibold">
                            {formatCurrency(balanceDue, inv.currency)}
                          </span>
                        ) : (
                          <span className="text-stone-400 font-normal">Paid in full</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.bg} ${badge.text}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="text-stone-400 hover:text-brand transition-colors p-1"
                        >
                          <ArrowRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
