'use client';

import { CreditCard, Clock } from 'lucide-react';

export default function PaymentsPage() {
  return (
    <div className="p-6 space-y-6">
      <header className="border-b border-border-light pb-4">
        <h1 className="text-2xl font-display font-bold text-stone-800">Payments</h1>
        <p className="text-xs text-stone-500 font-medium mt-1">Phase 2 &amp; 3 — Payments</p>
      </header>
      <div className="bg-panel border border-border-light rounded-xl p-12 text-center shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <CreditCard size={28} />
        </div>
        <h3 className="font-display font-bold text-stone-800 text-lg mb-2">Payment Ledger</h3>
        <p className="text-sm text-stone-500 font-medium max-w-md mx-auto leading-relaxed">
          Manual payment recording (Phase 2) and gateway reconciliation via Razorpay/Stripe webhooks (Phase 3) will appear here.
        </p>
        <div className="flex items-center justify-center gap-2 mt-4 text-xs text-stone-400 font-medium">
          <Clock size={13} /> Phase 2 — Invoicing Core
        </div>
      </div>
    </div>
  );
}
