'use client';

import { RefreshCcw, Clock } from 'lucide-react';

export default function SubscriptionsPage() {
  return (
    <div className="p-6 space-y-6">
      <header className="border-b border-border-light pb-4">
        <h1 className="text-2xl font-display font-bold text-stone-800">Subscriptions</h1>
        <p className="text-xs text-stone-500 font-medium mt-1">Phase 3 — Recurring Billing</p>
      </header>
      <div className="bg-panel border border-border-light rounded-xl p-12 text-center shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
          <RefreshCcw size={28} />
        </div>
        <h3 className="font-display font-bold text-stone-800 text-lg mb-2">Recurring Billing Engine</h3>
        <p className="text-sm text-stone-500 font-medium max-w-md mx-auto leading-relaxed">
          Subscription plans, automatic invoice generation via BullMQ cron jobs, and Razorpay/Stripe gateway integration will be built in Phase 3.
        </p>
        <div className="flex items-center justify-center gap-2 mt-4 text-xs text-stone-400 font-medium">
          <Clock size={13} /> Phase 3 — Recurring Billing &amp; Gateways
        </div>
      </div>
    </div>
  );
}
