'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function NewCustomerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    taxId: '',
    currency: 'INR',
    creditTermsDays: 30,
    notes: '',
    billingAddress: {
      line1: '',
      city: '',
      state: '',
      stateCode: '',
      pincode: '',
      country: 'India',
    },
  });

  const set = (field: string, value: string | number) =>
    setForm((f) => ({ ...f, [field]: value }));
  const setAddr = (field: string, value: string) =>
    setForm((f) => ({ ...f, billingAddress: { ...f.billingAddress, [field]: value } }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/v1/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          billingAddress: form.billingAddress.line1 ? form.billingAddress : undefined,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success('Customer created!');
        router.push(`/customers/${json.data.id}`);
      } else {
        toast.error(json.error ?? 'Failed to create customer');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <header className="flex items-center gap-3 border-b border-border-light pb-4">
        <Link href="/customers" className="text-stone-400 hover:text-stone-700 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-display font-bold text-stone-800">New Customer</h1>
          <p className="text-xs text-stone-500 font-medium mt-1">Add a new client to your organization</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-panel border border-border-light rounded-xl p-5 shadow-xs space-y-4">
          <h3 className="font-semibold text-stone-800 text-sm">Basic Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Customer Name *">
              <input required value={form.name} onChange={(e) => set('name', e.target.value)}
                className={inputCls} placeholder="Acme Corp" />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                className={inputCls} placeholder="billing@acme.com" />
            </Field>
            <Field label="Phone">
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)}
                className={inputCls} placeholder="+91-9876543210" />
            </Field>
            <Field label="GST / Tax ID">
              <input value={form.taxId} onChange={(e) => set('taxId', e.target.value)}
                className={inputCls} placeholder="29ABCDE1234F1Z5" />
            </Field>
            <Field label="Currency">
              <select value={form.currency} onChange={(e) => set('currency', e.target.value)} className={inputCls}>
                <option value="INR">INR — Indian Rupee</option>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
              </select>
            </Field>
            <Field label="Credit Terms (days)">
              <input type="number" min={0} value={form.creditTermsDays}
                onChange={(e) => set('creditTermsDays', parseInt(e.target.value) || 0)}
                className={inputCls} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)}
              className={inputCls + ' resize-none h-20'} placeholder="Internal notes about this customer..." />
          </Field>
        </div>

        {/* Billing Address */}
        <div className="bg-panel border border-border-light rounded-xl p-5 shadow-xs space-y-4">
          <h3 className="font-semibold text-stone-800 text-sm">Billing Address <span className="text-stone-400 font-normal">(optional)</span></h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Address Line 1" className="sm:col-span-2">
              <input value={form.billingAddress.line1} onChange={(e) => setAddr('line1', e.target.value)}
                className={inputCls} placeholder="123 MG Road" />
            </Field>
            <Field label="City">
              <input value={form.billingAddress.city} onChange={(e) => setAddr('city', e.target.value)}
                className={inputCls} placeholder="Bangalore" />
            </Field>
            <Field label="State">
              <input value={form.billingAddress.state} onChange={(e) => setAddr('state', e.target.value)}
                className={inputCls} placeholder="Karnataka" />
            </Field>
            <Field label="State Code">
              <input value={form.billingAddress.stateCode} onChange={(e) => setAddr('stateCode', e.target.value)}
                className={inputCls} placeholder="29" />
            </Field>
            <Field label="Pincode">
              <input value={form.billingAddress.pincode} onChange={(e) => setAddr('pincode', e.target.value)}
                className={inputCls} placeholder="560001" />
            </Field>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading}
            className="bg-brand hover:bg-brand-dark text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-60">
            {loading ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={13} />}
            Save Customer
          </button>
          <Link href="/customers"
            className="border border-border-light text-stone-600 hover:text-stone-800 text-xs font-semibold px-5 py-2.5 rounded-xl transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  'w-full border border-border-light rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand/40 transition-colors bg-white';

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-stone-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
