'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, Plus, Users, X, Gift } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/lib/money';

interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  loyaltyPoints: number;
  balanceDue: number;
  _count?: { sales: number };
}

function TierBadge({ pts }: { pts: number }) {
  if (pts >= 5000) return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700">💎 Platinum</span>;
  if (pts >= 2000) return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">🥇 Gold</span>;
  if (pts >= 500)  return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600">🥈 Silver</span>;
  if (pts > 0)     return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700">🥉 Bronze</span>;
  return null;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' });
  const [saving, setSaving] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: '50' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/v1/customers?${params}`);
      const json = await res.json();
      setCustomers(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchCustomers, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchCustomers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Customer name is required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/v1/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success('Customer added!');
        setShowModal(false);
        setForm({ name: '', phone: '', email: '', address: '' });
        fetchCustomers();
      } else {
        toast.error(json.error ?? 'Failed to add customer');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-light pb-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-stone-800">Customers</h1>
          <p className="text-xs text-stone-500 font-medium mt-1">
            Store customer directory, contact numbers, and purchase history
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-brand hover:bg-brand-dark text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors shadow-sm self-start sm:self-auto cursor-pointer"
        >
          <Plus size={14} /> Add Customer
        </button>
      </header>

      {/* Search */}
      <div className="flex justify-between items-center">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search by customer name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-panel border border-border-light rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-brand/40 shadow-xs"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-panel border border-border-light rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50 text-stone-400 font-semibold border-b border-border-light">
                <th className="p-3">CUSTOMER</th>
                <th className="p-3">PHONE</th>
                <th className="p-3">ADDRESS</th>
                <th className="p-3 text-center">LOYALTY POINTS</th>
                <th className="p-3 text-center">TOTAL VISITS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-stone-400">
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-stone-400">
                    <Users size={32} className="mx-auto text-stone-200 mb-2" />
                    No customers found
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="p-3">
                      <span className="font-bold text-stone-800 block">{c.name}</span>
                      {c.email && (
                        <span className="text-[10px] text-stone-400">{c.email}</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-stone-600">
                      {c.phone ? c.phone : '—'}
                    </td>
                    <td className="p-3 text-stone-500">
                      {c.address ? c.address : '—'}
                    </td>
                    <td className="p-3 text-center">
                      {c.loyaltyPoints > 0 ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-bold text-stone-800">{c.loyaltyPoints.toLocaleString()} pts</span>
                          <TierBadge pts={c.loyaltyPoints} />
                        </div>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span className="bg-stone-100 text-stone-700 font-bold px-2 py-0.5 rounded-full text-[10px]">
                        {c._count?.sales ?? 0} bills
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Customer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-panel border border-border-light rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-border-light pb-3">
              <h3 className="font-bold text-sm text-stone-800">Add Customer</h3>
              <button onClick={() => setShowModal(false)} className="text-stone-400">
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block text-stone-600 font-semibold mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-border-light rounded-lg p-2.5 focus:outline-none focus:border-brand bg-white"
                  placeholder="e.g. Ramesh Kumar"
                />
              </div>

              <div>
                <label className="block text-stone-600 font-semibold mb-1">Phone Number</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full border border-border-light rounded-lg p-2.5 focus:outline-none focus:border-brand bg-white font-mono"
                  placeholder="+91 98450 00000"
                />
              </div>

              <div>
                <label className="block text-stone-600 font-semibold mb-1">Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full border border-border-light rounded-lg p-2.5 focus:outline-none focus:border-brand bg-white"
                  placeholder="Area / Building / City"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-brand hover:bg-brand-dark text-white font-bold py-2.5 rounded-xl transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Customer'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="border border-border-light text-stone-600 px-4 py-2.5 rounded-xl cursor-pointer"
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
