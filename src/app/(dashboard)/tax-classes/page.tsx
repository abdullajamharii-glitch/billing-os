'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Receipt, Percent } from 'lucide-react';
import { bpsToPercent } from '@/lib/money';

interface TaxClass {
  id: string;
  name: string;
  rate: number;
  type: string;
  components?: Record<string, number>;
  isActive: boolean;
}

const TYPE_STYLES: Record<string, string> = {
  GST: 'bg-blue-50 text-blue-700',
  VAT: 'bg-purple-50 text-purple-700',
  NONE: 'bg-stone-100 text-stone-600',
};

export default function TaxClassesPage() {
  const [taxClasses, setTaxClasses] = useState<TaxClass[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/tax-classes')
      .then((r) => r.json())
      .then((json) => setTaxClasses(json.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between border-b border-border-light pb-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-stone-800">Tax Classes</h1>
          <p className="text-xs text-stone-500 font-medium mt-1">
            GST, VAT and tax-exempt classes for invoices
          </p>
        </div>
        <Link
          href="/tax-classes/new"
          className="bg-brand hover:bg-brand-dark text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={14} /> New Tax Class
        </Link>
      </header>

      <div className="bg-panel border border-border-light rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50 text-stone-400 font-semibold border-b border-border-light">
                <th className="p-3">NAME</th>
                <th className="p-3">TYPE</th>
                <th className="p-3 text-right">RATE</th>
                <th className="p-3">COMPONENTS</th>
                <th className="p-3 text-center">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-stone-400">
                    Loading tax classes...
                  </td>
                </tr>
              ) : taxClasses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <Receipt size={32} className="mx-auto text-stone-200 mb-3" />
                    <p className="text-stone-500 font-medium">No tax classes yet</p>
                    <Link href="/tax-classes/new" className="text-brand text-xs font-semibold mt-2 inline-block">
                      Create GST 18% →
                    </Link>
                  </td>
                </tr>
              ) : (
                taxClasses.map((tc) => (
                  <tr key={tc.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-brand-light text-brand flex items-center justify-center">
                          <Percent size={12} />
                        </div>
                        <span className="font-semibold text-stone-800">{tc.name}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${TYPE_STYLES[tc.type] ?? 'bg-stone-100 text-stone-600'}`}>
                        {tc.type}
                      </span>
                    </td>
                    <td className="p-3 text-right font-bold text-stone-800">
                      {bpsToPercent(tc.rate)}
                    </td>
                    <td className="p-3 text-stone-500">
                      {tc.components
                        ? Object.entries(tc.components)
                            .map(([k, v]) => `${k}: ${bpsToPercent(v)}`)
                            .join(' + ')
                        : '—'}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          tc.isActive
                            ? 'bg-status-ok-bg text-status-ok'
                            : 'bg-stone-100 text-stone-500'
                        }`}
                      >
                        {tc.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
