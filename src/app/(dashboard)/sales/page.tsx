'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Receipt,
  Search,
  Printer,
  Calendar,
  Eye,
  CheckCircle,
  X,
  CreditCard,
  Banknote,
  QrCode,
  ShoppingBag,
} from 'lucide-react';
import { formatCurrency, paiseToRupees } from '@/lib/money';
import { ThermalReceiptEngine } from '@/lib/thermal-receipt';

interface SaleItem {
  id: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
}

interface Sale {
  id: string;
  billNumber: string;
  customerName: string;
  customerPhone?: string;
  total: number;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  paymentMethod: string;
  createdAt: string;
  items: SaleItem[];
  user?: { name: string };
  org?: any;
}

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: '50' });
      if (search) params.set('search', search);
      if (paymentFilter) params.set('paymentMethod', paymentFilter);
      const res = await fetch(`/api/v1/sales?${params}`);
      const json = await res.json();
      setSales(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [search, paymentFilter]);

  useEffect(() => {
    const t = setTimeout(fetchSales, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchSales]);

  const handleReprint = (sale: Sale) => {
    const printData = {
      shopName: 'Ameen Supermarket',
      billNumber: sale.billNumber,
      date: new Date(sale.createdAt).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      }),
      cashierName: sale.user?.name || 'Cashier',
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      subtotal: paiseToRupees(sale.subtotal),
      taxTotal: paiseToRupees(sale.taxTotal),
      discountTotal: paiseToRupees(sale.discountTotal),
      grandTotal: paiseToRupees(sale.total),
      paymentMethod: sale.paymentMethod,
      items: sale.items.map((it) => ({
        name: it.productName,
        quantity: it.quantity,
        unit: it.unit,
        price: paiseToRupees(it.unitPrice),
        total: paiseToRupees(it.lineTotal),
      })),
    };

    const html = ThermalReceiptEngine.generateHtml(printData, '80mm');
    try {
      let iframe = document.getElementById('sales-reprint-iframe') as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'sales-reprint-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.opacity = '0';
        document.body.appendChild(iframe);
      }
      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        }, 150);
        return;
      }
    } catch (e) {
      console.warn('Iframe print failed, falling back:', e);
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  const totalCollected = sales.reduce((acc, s) => acc + s.total, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-light pb-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-stone-800">
            Sales &amp; Bills History
          </h1>
          <p className="text-xs text-stone-500 font-medium mt-1">
            All generated retail bills, receipts, payment breakdowns, and reprints
          </p>
        </div>

        <Link
          href="/billing"
          className="bg-brand hover:bg-brand-dark text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors shadow-sm self-start sm:self-auto"
        >
          <ShoppingBag size={14} /> Open Billing Counter
        </Link>
      </header>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {['', 'CASH', 'UPI', 'CARD'].map((method) => (
            <button
              key={method}
              onClick={() => setPaymentFilter(method)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                paymentFilter === method
                  ? 'bg-stone-800 text-white'
                  : 'bg-panel border border-border-light text-stone-600 hover:bg-stone-100'
              }`}
            >
              {method ? method : 'All Payments'}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search bill number or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-panel border border-border-light rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-brand/40 shadow-xs"
          />
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-panel border border-border-light rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50 text-stone-400 font-semibold border-b border-border-light">
                <th className="p-3">BILL #</th>
                <th className="p-3">DATE &amp; TIME</th>
                <th className="p-3">CUSTOMER</th>
                <th className="p-3 text-center">ITEMS</th>
                <th className="p-3 text-center">PAYMENT</th>
                <th className="p-3 text-right">TOTAL</th>
                <th className="p-3 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-stone-400">
                    Loading bills...
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-stone-400">
                    <Receipt size={32} className="mx-auto text-stone-200 mb-2" />
                    No sales recorded
                  </td>
                </tr>
              ) : (
                sales.map((s) => (
                  <tr key={s.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="p-3 font-bold text-brand">{s.billNumber}</td>
                    <td className="p-3 text-stone-500">
                      {new Date(s.createdAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="p-3 font-medium text-stone-800">
                      {s.customerName}
                      {s.customerPhone && (
                        <span className="block text-[10px] text-stone-400">
                          {s.customerPhone}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span className="bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md font-bold text-[10px]">
                        {s.items.length} items
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.paymentMethod === 'CASH'
                            ? 'bg-emerald-50 text-emerald-700'
                            : s.paymentMethod === 'UPI'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-purple-50 text-purple-700'
                        }`}
                      >
                        {s.paymentMethod}
                      </span>
                    </td>
                    <td className="p-3 text-right font-bold text-stone-900">
                      {formatCurrency(s.total)}
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <button
                        onClick={() => setSelectedSale(s)}
                        className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
                        title="View Receipt"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        onClick={() => handleReprint(s)}
                        className="text-stone-400 hover:text-brand p-1.5 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
                        title="Print Thermal Receipt"
                      >
                        <Printer size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill Detail Modal */}
      {selectedSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-panel border border-border-light rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-border-light pb-3">
              <div>
                <h3 className="font-display font-bold text-base text-stone-800">
                  {selectedSale.billNumber}
                </h3>
                <span className="text-[10px] text-stone-400">
                  {new Date(selectedSale.createdAt).toLocaleString('en-IN')}
                </span>
              </div>
              <button onClick={() => setSelectedSale(null)} className="text-stone-400">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-500">Customer:</span>
                <span className="font-semibold">{selectedSale.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Payment:</span>
                <span className="font-semibold text-brand">{selectedSale.paymentMethod}</span>
              </div>
            </div>

            {/* Items */}
            <div className="border border-border-light rounded-xl overflow-hidden text-xs">
              <table className="w-full">
                <thead className="bg-stone-50 text-stone-500 border-b border-border-light">
                  <tr>
                    <th className="p-2 text-left">Item</th>
                    <th className="p-2 text-center">Qty</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {selectedSale.items.map((it) => (
                    <tr key={it.id}>
                      <td className="p-2 font-medium">{it.productName}</td>
                      <td className="p-2 text-center text-stone-500">
                        {it.quantity} {it.unit}
                      </td>
                      <td className="p-2 text-right font-bold">{formatCurrency(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="space-y-1 text-xs border-t border-border-light pt-2">
              <div className="flex justify-between text-stone-500">
                <span>Subtotal:</span>
                <span>{formatCurrency(selectedSale.subtotal)}</span>
              </div>
              {selectedSale.taxTotal > 0 && (
                <div className="flex justify-between text-stone-500">
                  <span>GST:</span>
                  <span>{formatCurrency(selectedSale.taxTotal)}</span>
                </div>
              )}
              <div className="flex justify-between font-extrabold text-sm text-stone-900 pt-1 border-t border-border-light">
                <span>Grand Total:</span>
                <span className="text-brand">{formatCurrency(selectedSale.total)}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleReprint(selectedSale)}
                className="flex-1 bg-brand hover:bg-brand-dark text-white font-bold text-xs py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer size={13} /> Print Thermal Receipt
              </button>
              <button
                onClick={() => setSelectedSale(null)}
                className="border border-border-light text-stone-600 px-4 py-2.5 rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
