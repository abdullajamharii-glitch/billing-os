'use client';

import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  ShoppingBag,
  PieChart,
  Printer,
  Package,
  AlertTriangle,
  CreditCard,
  Banknote,
  QrCode,
  ArrowUpRight,
  Loader2,
  FileText,
  Download,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/money';

export default function ShopReportsPage() {
  const [period, setPeriod] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('today');
  const [reportData, setReportData] = useState<any>(null);
  const [gstData, setGstData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async (selectedPeriod: string) => {
    setLoading(true);
    try {
      const [repRes, gstRes] = await Promise.all([
        fetch(`/api/v1/reports?period=${selectedPeriod}`),
        fetch(`/api/v1/reports/gst?period=${selectedPeriod}`),
      ]);
      const repJson = await repRes.json();
      const gstJson = await gstRes.json();
      if (repJson.success) setReportData(repJson.data);
      if (gstJson.success) setGstData(gstJson.data);
    } catch (e) {
      console.error('Failed to fetch reports:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleExportGstr1Json = () => {
    if (!gstData) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(gstData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `GSTR1_${period}_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  useEffect(() => {
    fetchReports(period);
  }, [period]);

  const handlePrintZReport = () => {
    if (loading) return;
    window.print();
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'today':
        return `Today (${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})`;
      case 'yesterday': {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        return `Yesterday (${y.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})`;
      }
      case 'week':
        return 'This Week';
      case 'month':
        return `This Month (${new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })})`;
      case 'all':
        return 'All Time (Historical)';
      default:
        return period;
    }
  };

  const summary = reportData?.summary ?? {
    totalSalesCount: 0,
    totalRevenue: 0,
    totalCost: 0,
    grossProfit: 0,
    profitMarginPercent: '0',
    totalTax: 0,
    totalDiscount: 0,
    averageBillValue: 0,
  };

  const payments = reportData?.paymentBreakdown ?? {};
  const topProducts = reportData?.topProducts ?? [];
  const lowStock = reportData?.lowStockProducts ?? [];

  return (
    <div className="p-6 space-y-6 print:p-6 print:space-y-4 print:max-w-none print:w-full print:bg-white">
      {/* -------------------------------------------------------------
          PRINTABLE REPORT HEADER (Visible ONLY when printing)
          ------------------------------------------------------------- */}
      <div className="hidden print:block border-b-2 border-stone-800 pb-4 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-display font-extrabold text-stone-900 tracking-tight">
              AMEEN SUPERMARKET &amp; PROVISION STORE
            </h1>
            <p className="text-xs text-stone-600 font-medium">
              Daily Operations, Z-Report &amp; Financial Analytics
            </p>
          </div>
          <div className="text-right">
            <div className="inline-block bg-stone-900 text-white text-[11px] font-bold px-2.5 py-1 rounded">
              Z-REPORT / SALES AUDIT
            </div>
            <p className="text-[11px] text-stone-500 font-medium mt-1">
              Generated: {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-stone-200 flex justify-between items-center text-xs">
          <div>
            <span className="text-stone-500 font-semibold">Report Period: </span>
            <span className="font-bold text-stone-900 uppercase">{getPeriodLabel()}</span>
          </div>
          <div>
            <span className="text-stone-500 font-semibold">Status: </span>
            <span className="font-bold text-emerald-700">Verified Final</span>
          </div>
        </div>
      </div>

      {/* Screen Header (Hidden on print) */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-light pb-4 print:hidden">
        <div>
          <h1 className="text-2xl font-display font-bold text-stone-800">
            Shop Analytics &amp; Reports
          </h1>
          <p className="text-xs text-stone-500 font-medium mt-1">
            Day-end Z-Report, revenue collections, profit margins, and top selling products
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex items-center bg-stone-200/60 p-1 rounded-xl">
            {[
              { label: 'Today', value: 'today' },
              { label: 'Yesterday', value: 'yesterday' },
              { label: 'This Week', value: 'week' },
              { label: 'This Month', value: 'month' },
              { label: 'All Time', value: 'all' },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setPeriod(tab.value as any)}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  period === tab.value
                    ? 'bg-white text-stone-800 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={handlePrintZReport}
            disabled={loading}
            className="bg-white border border-border-light hover:bg-stone-50 disabled:opacity-50 text-stone-700 text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
            Print Report
          </button>
        </div>
      </header>

      {/* -------------------------------------------------------------
          4 KPI SUMMARY METRIC CARDS
          ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4 print:gap-3 print:break-inside-avoid">
        {/* Total Sales Revenue */}
        <div className="bg-panel border border-border-light rounded-2xl p-5 shadow-xs space-y-1 print:bg-white print:border print:border-stone-300 print:shadow-none print:p-3.5 print:rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-400 print:text-stone-600 uppercase tracking-wider">
              Total Revenue
            </span>
            <div className="w-8 h-8 rounded-xl bg-brand-light text-brand flex items-center justify-center print:hidden">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="font-display font-extrabold text-2xl text-stone-800 print:text-stone-900 print:text-xl">
            {formatCurrency(summary.totalRevenue)}
          </div>
          <p className="text-[11px] text-stone-400 print:text-stone-600 font-medium">
            From {summary.totalSalesCount} bills generated
          </p>
        </div>

        {/* Gross Profit & Margin */}
        <div className="bg-panel border border-border-light rounded-2xl p-5 shadow-xs space-y-1 print:bg-white print:border print:border-stone-300 print:shadow-none print:p-3.5 print:rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-400 print:text-stone-600 uppercase tracking-wider">
              Gross Profit
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center print:hidden">
              <ArrowUpRight size={16} />
            </div>
          </div>
          <div className="font-display font-extrabold text-2xl text-emerald-700 print:text-stone-900 print:text-xl">
            {formatCurrency(summary.grossProfit)}
          </div>
          <p className="text-[11px] text-emerald-700 print:text-stone-600 font-medium">
            Margin: {summary.profitMarginPercent}% of sales
          </p>
        </div>

        {/* Average Bill Value */}
        <div className="bg-panel border border-border-light rounded-2xl p-5 shadow-xs space-y-1 print:bg-white print:border print:border-stone-300 print:shadow-none print:p-3.5 print:rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-400 print:text-stone-600 uppercase tracking-wider">
              Avg Bill Value
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center print:hidden">
              <ShoppingBag size={16} />
            </div>
          </div>
          <div className="font-display font-extrabold text-2xl text-stone-800 print:text-stone-900 print:text-xl">
            {formatCurrency(summary.averageBillValue)}
          </div>
          <p className="text-[11px] text-stone-400 print:text-stone-600 font-medium">Per customer basket size</p>
        </div>

        {/* GST Tax Collected */}
        <div className="bg-panel border border-border-light rounded-2xl p-5 shadow-xs space-y-1 print:bg-white print:border print:border-stone-300 print:shadow-none print:p-3.5 print:rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-400 print:text-stone-600 uppercase tracking-wider">
              GST Collected
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center print:hidden">
              <PieChart size={16} />
            </div>
          </div>
          <div className="font-display font-extrabold text-2xl text-stone-800 print:text-stone-900 print:text-xl">
            {formatCurrency(summary.totalTax)}
          </div>
          <p className="text-[11px] text-stone-400 print:text-stone-600 font-medium">Ready for GSTR filing</p>
        </div>
      </div>

      {/* -------------------------------------------------------------
          MIDDLE: PAYMENT BREAKDOWN & TOP SELLING PRODUCTS
          ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:grid-cols-3 print:gap-4 print:break-inside-avoid">
        {/* Payment Collections (Day End Z-Report breakdown) */}
        <div className="bg-panel border border-border-light rounded-2xl p-5 shadow-xs space-y-4 print:bg-white print:border print:border-stone-300 print:shadow-none print:p-4 print:rounded-xl">
          <h3 className="font-display font-bold text-sm text-stone-800 flex items-center gap-2">
            <CreditCard size={16} className="text-brand print:hidden" /> Payment Method Breakdown
          </h3>

          <div className="space-y-3 text-xs">
            {/* Cash */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 print:bg-white print:border-stone-200">
              <div className="flex items-center gap-2.5">
                <Banknote size={18} className="text-emerald-700 print:hidden" />
                <div>
                  <span className="font-bold text-stone-800 block">Cash in Drawer</span>
                  <span className="text-[10px] text-stone-500">
                    {payments.CASH?.count || 0} transactions
                  </span>
                </div>
              </div>
              <span className="font-display font-extrabold text-sm text-emerald-800 print:text-stone-900">
                {formatCurrency(payments.CASH?.total || 0)}
              </span>
            </div>

            {/* UPI */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/50 border border-blue-100 print:bg-white print:border-stone-200">
              <div className="flex items-center gap-2.5">
                <QrCode size={18} className="text-blue-700 print:hidden" />
                <div>
                  <span className="font-bold text-stone-800 block">UPI QR Payments</span>
                  <span className="text-[10px] text-stone-500">
                    {payments.UPI?.count || 0} transactions
                  </span>
                </div>
              </div>
              <span className="font-display font-extrabold text-sm text-blue-800 print:text-stone-900">
                {formatCurrency(payments.UPI?.total || 0)}
              </span>
            </div>

            {/* Card */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50/50 border border-purple-100 print:bg-white print:border-stone-200">
              <div className="flex items-center gap-2.5">
                <CreditCard size={18} className="text-purple-700 print:hidden" />
                <div>
                  <span className="font-bold text-stone-800 block">Card POS Swipes</span>
                  <span className="text-[10px] text-stone-500">
                    {payments.CARD?.count || 0} transactions
                  </span>
                </div>
              </div>
              <span className="font-display font-extrabold text-sm text-purple-800 print:text-stone-900">
                {formatCurrency(payments.CARD?.total || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="lg:col-span-2 bg-panel border border-border-light rounded-2xl p-5 shadow-xs space-y-4 print:col-span-2 print:bg-white print:border print:border-stone-300 print:shadow-none print:p-4 print:rounded-xl">
          <h3 className="font-display font-bold text-sm text-stone-800 flex items-center gap-2">
            <Package size={16} className="text-brand print:hidden" /> Top Selling Items
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-600 font-semibold border-b border-border-light print:bg-stone-100 print:text-stone-800">
                  <th className="p-2.5">PRODUCT</th>
                  <th className="p-2.5 text-center">UNITS SOLD</th>
                  <th className="p-2.5 text-right">TOTAL REVENUE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light print:divide-stone-200">
                {topProducts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-stone-400">
                      No sales in selected period
                    </td>
                  </tr>
                ) : (
                  topProducts.map((it: any, idx: number) => (
                    <tr key={idx} className="hover:bg-stone-50/50">
                      <td className="p-2.5 font-semibold text-stone-800">
                        {idx + 1}. {it.name}
                      </td>
                      <td className="p-2.5 text-center text-stone-600 font-medium">
                        {it.quantity} {it.unit}
                      </td>
                      <td className="p-2.5 text-right font-bold text-stone-900">
                        {formatCurrency(it.revenue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          GST STATUTORY COMPLIANCE & GSTR-1 RETURN SUMMARY
          ------------------------------------------------------------- */}
      <div className="bg-panel border border-border-light rounded-2xl p-5 shadow-xs space-y-5 print:bg-white print:border print:border-stone-300 print:shadow-none print:p-4 print:rounded-xl print:break-inside-avoid">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-light pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-brand" />
              <h3 className="font-display font-bold text-sm text-stone-900">
                GST Compliance &amp; GSTR-1 Return Breakdown
              </h3>
              <span className="bg-brand-light text-brand text-[10px] font-mono font-bold px-2 py-0.5 rounded-md">
                SAC 996331 · Rule 46 Compliant
              </span>
            </div>
            <p className="text-xs text-stone-500">
              Statutory 5% GST split into CGST (2.5%) + SGST (2.5%) for restaurant and food services.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200">
              GSTIN: {gstData?.org?.gstin || '32AABCA1234A1Z5'}
            </span>
            <button
              onClick={handleExportGstr1Json}
              disabled={!gstData}
              className="bg-brand hover:bg-brand-dark disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer print:hidden shadow-xs"
              title="Download GSTR-1 filing JSON payload"
            >
              <Download size={13} />
              <span>Export GSTR-1 JSON</span>
            </button>
          </div>
        </div>

        {/* 4 Tax Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-stone-50/70 border border-border-light rounded-xl p-3 space-y-1">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
              Taxable Value
            </span>
            <span className="font-display font-extrabold text-base text-stone-800 block">
              {formatCurrency(gstData?.summary?.taxableTurnover || 0)}
            </span>
            <span className="text-[10px] text-stone-400">Net of 5% tax</span>
          </div>

          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 space-y-1">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">
              CGST (2.5%)
            </span>
            <span className="font-display font-extrabold text-base text-blue-900 block">
              {formatCurrency(gstData?.summary?.cgstTotal || 0)}
            </span>
            <span className="text-[10px] text-blue-600">Central Tax</span>
          </div>

          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 space-y-1">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
              SGST (2.5%)
            </span>
            <span className="font-display font-extrabold text-base text-emerald-900 block">
              {formatCurrency(gstData?.summary?.sgstTotal || 0)}
            </span>
            <span className="text-[10px] text-emerald-600">State Tax</span>
          </div>

          <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-3 space-y-1">
            <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider block">
              Total Tax Collected
            </span>
            <span className="font-display font-extrabold text-base text-purple-900 block">
              {formatCurrency(gstData?.summary?.totalTax || 0)}
            </span>
            <span className="text-[10px] text-purple-600">CGST + SGST</span>
          </div>
        </div>

        {/* Tables: Table 4 (B2B) / Table 7 (B2C) & Table 12 (HSN) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Table 4 & Table 7 Breakdown */}
          <div className="border border-border-light rounded-xl p-4 bg-stone-50/40 space-y-3">
            <h4 className="font-bold text-xs text-stone-700 flex items-center gap-1.5">
              <FileText size={14} className="text-brand" />
              GSTR-1 Invoicing Tables
            </h4>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-white border border-border-light rounded-lg">
                <div className="flex justify-between items-center font-semibold text-stone-800">
                  <span>Table 7: B2C Retail (Consumer)</span>
                  <span className="text-[11px] bg-stone-100 px-1.5 py-0.5 rounded font-mono">
                    {gstData?.b2c?.invoiceCount || 0} bills
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-stone-500 mt-1">
                  <span>Taxable: {formatCurrency(gstData?.b2c?.taxableValue || 0)}</span>
                  <span className="font-bold text-stone-700">Tax: {formatCurrency((gstData?.b2c?.cgst || 0) + (gstData?.b2c?.sgst || 0))}</span>
                </div>
              </div>

              <div className="p-2.5 bg-white border border-border-light rounded-lg">
                <div className="flex justify-between items-center font-semibold text-stone-800">
                  <span>Table 4: B2B Invoices (With GSTIN)</span>
                  <span className="text-[11px] bg-stone-100 px-1.5 py-0.5 rounded font-mono">
                    {gstData?.b2b?.invoiceCount || 0} bills
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-stone-500 mt-1">
                  <span>Taxable: {formatCurrency(gstData?.b2b?.taxableValue || 0)}</span>
                  <span className="font-bold text-stone-700">Tax: {formatCurrency((gstData?.b2b?.cgst || 0) + (gstData?.b2b?.sgst || 0))}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Table 12: HSN/SAC Summary */}
          <div className="lg:col-span-2 border border-border-light rounded-xl p-4 bg-stone-50/40 space-y-3">
            <h4 className="font-bold text-xs text-stone-700 flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600" />
              Table 12: HSN / SAC Summary
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border-light text-[10px] text-stone-500 font-bold uppercase">
                    <th className="pb-1.5">HSN/SAC</th>
                    <th className="pb-1.5">Description</th>
                    <th className="pb-1.5 text-center">Qty</th>
                    <th className="pb-1.5 text-right">Taxable</th>
                    <th className="pb-1.5 text-right">CGST</th>
                    <th className="pb-1.5 text-right">SGST</th>
                    <th className="pb-1.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {(!gstData?.hsnSummary || gstData.hsnSummary.length === 0) ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-stone-400 text-xs">
                        No HSN transactions in selected period
                      </td>
                    </tr>
                  ) : (
                    gstData.hsnSummary.map((hsn: any, idx: number) => (
                      <tr key={idx} className="hover:bg-white/60">
                        <td className="py-2 font-mono font-bold text-brand">
                          {hsn.hsnCode}
                        </td>
                        <td className="py-2 text-stone-700 font-medium">
                          {hsn.description}
                        </td>
                        <td className="py-2 text-center text-stone-600 font-mono">
                          {hsn.totalQuantity} {hsn.uqc}
                        </td>
                        <td className="py-2 text-right font-mono text-stone-800">
                          {formatCurrency(hsn.taxableValue)}
                        </td>
                        <td className="py-2 text-right font-mono text-blue-700 font-medium">
                          {formatCurrency(hsn.cgst)}
                        </td>
                        <td className="py-2 text-right font-mono text-emerald-700 font-medium">
                          {formatCurrency(hsn.sgst)}
                        </td>
                        <td className="py-2 text-right font-mono font-bold text-stone-900">
                          {formatCurrency(hsn.totalValue)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          BOTTOM: LOW STOCK INVENTORY ALERTS
          ------------------------------------------------------------- */}
      {lowStock.length > 0 && (
        <div className="bg-panel border border-amber-200 rounded-2xl p-5 shadow-xs space-y-3 print:bg-white print:border print:border-stone-300 print:shadow-none print:p-4 print:rounded-xl print:break-inside-avoid">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600 print:hidden" />
            <h3 className="font-display font-bold text-sm text-stone-800">
              Low Stock Alerts (Reorder Recommended)
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 print:grid-cols-4 print:gap-2">
            {lowStock.map((prod: any) => (
              <div
                key={prod.id}
                className="bg-amber-50/40 border border-amber-200/80 rounded-xl p-3 text-xs space-y-1 print:bg-white print:border-stone-200"
              >
                <span className="font-bold text-stone-800 block truncate">{prod.name}</span>
                <div className="flex justify-between text-stone-500 text-[11px]">
                  <span>Available:</span>
                  <span className="font-bold text-red-600 print:text-stone-900">
                    {prod.stock} {prod.unit}
                  </span>
                </div>
                <div className="flex justify-between text-stone-400 text-[10px]">
                  <span>Min alert level:</span>
                  <span>{prod.minStock} {prod.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          PRINTABLE REPORT FOOTER (Visible ONLY when printing)
          ------------------------------------------------------------- */}
      <div className="hidden print:flex justify-between items-center pt-6 mt-6 border-t border-stone-300 text-[11px] text-stone-500 print:break-inside-avoid">
        <div>
          <p className="font-bold text-stone-700">Ameen Supermarket POS System</p>
          <p>Confidential &amp; Proprietary Management Report</p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-stone-700">Manager / Auditor Signature: _______________________</p>
        </div>
      </div>
    </div>
  );
}
