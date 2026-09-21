'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Tag, ArrowRight } from 'lucide-react';
import { formatCurrency, bpsToPercent } from '@/lib/money';

interface Plan {
  id: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  billingCycle: string;
  isActive: boolean;
  taxClass?: { name: string; rate: number };
}

const CYCLE_LABEL: Record<string, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
  CUSTOM: 'Custom',
};

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/plans?pageSize=50')
      .then((r) => r.json())
      .then((json) => setPlans(json.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between border-b border-border-light pb-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-stone-800">Plans</h1>
          <p className="text-xs text-stone-500 font-medium mt-1">
            Recurring billing plans for subscriptions
          </p>
        </div>
        <Link
          href="/plans/new"
          className="bg-brand hover:bg-brand-dark text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={14} /> New Plan
        </Link>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 p-12 text-center text-stone-400">Loading plans...</div>
        ) : plans.length === 0 ? (
          <div className="col-span-3 bg-panel border border-border-light rounded-xl p-12 text-center shadow-xs">
            <Tag size={32} className="mx-auto text-stone-200 mb-3" />
            <p className="text-stone-500 font-medium">No plans yet</p>
            <Link href="/plans/new" className="text-brand text-xs font-semibold mt-2 inline-block">
              Create your first plan →
            </Link>
          </div>
        ) : (
          plans.map((plan) => (
            <div
              key={plan.id}
              className="bg-panel border border-border-light rounded-xl p-5 shadow-xs hover:shadow-md hover:border-brand/30 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-light text-brand flex items-center justify-center">
                    <Tag size={16} />
                  </div>
                  <span className="bg-stone-100 text-stone-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {CYCLE_LABEL[plan.billingCycle] ?? plan.billingCycle}
                  </span>
                </div>
                <h3 className="font-display font-bold text-stone-800 text-base group-hover:text-brand transition-colors">
                  {plan.name}
                </h3>
                {plan.description && (
                  <p className="text-xs text-stone-500 mt-1 font-medium leading-relaxed">
                    {plan.description}
                  </p>
                )}
                <div className="mt-4">
                  <span className="text-2xl font-extrabold text-stone-800">
                    {formatCurrency(plan.amount, plan.currency)}
                  </span>
                  <span className="text-xs text-stone-400 ml-1">
                    /{CYCLE_LABEL[plan.billingCycle]?.toLowerCase() ?? 'period'}
                  </span>
                </div>
                {plan.taxClass && (
                  <p className="text-[10px] text-stone-400 mt-1">
                    {plan.taxClass.name} ({bpsToPercent(plan.taxClass.rate)} tax)
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-stone-100">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    plan.isActive
                      ? 'bg-status-ok-bg text-status-ok'
                      : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  {plan.isActive ? 'Active' : 'Archived'}
                </span>
                <Link
                  href={`/plans/${plan.id}`}
                  className="text-brand hover:text-brand-dark transition-colors flex items-center gap-1 text-xs font-semibold"
                >
                  Edit <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
