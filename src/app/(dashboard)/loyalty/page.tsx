'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Gift, Star, TrendingUp, Users, Award, RefreshCw, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/lib/money';

interface LoyaltyConfig {
  isEnabled: boolean;
  pointsPerHundred: number;
  pointValuePaise: number;
  minPointsRedeem: number;
  bronzeThreshold: number;
  silverThreshold: number;
  goldThreshold: number;
  platinumThreshold: number;
}

interface CustomerRow {
  id: string;
  name: string;
  phone?: string;
  loyaltyPoints: number;
  _count?: { sales: number };
}

interface LoyaltyTxn {
  id: string;
  type: 'EARN' | 'REDEEM' | 'ADJUST' | 'EXPIRE';
  points: number;
  balanceAfter: number;
  note?: string;
  createdAt: string;
  customer: { name: string; phone?: string };
  sale?: { billNumber: string };
}

function getTier(pts: number, cfg: LoyaltyConfig) {
  if (pts >= cfg.platinumThreshold) return { label: 'Platinum', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', dot: 'bg-purple-500', emoji: '💎' };
  if (pts >= cfg.goldThreshold)     return { label: 'Gold',     color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',   dot: 'bg-amber-500',  emoji: '🥇' };
  if (pts >= cfg.silverThreshold)   return { label: 'Silver',   color: 'text-slate-600',  bg: 'bg-slate-50 border-slate-200',   dot: 'bg-slate-400',  emoji: '🥈' };
  return { label: 'Bronze', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-400', emoji: '🥉' };
}

export default function LoyaltyPage() {
  const [config, setConfig] = useState<LoyaltyConfig | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [transactions, setTransactions] = useState<LoyaltyTxn[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, custRes, txnRes] = await Promise.all([
        fetch('/api/v1/loyalty/config'),
        fetch('/api/v1/customers?pageSize=50'),
        fetch('/api/v1/loyalty/transactions?pageSize=20'),
      ]);
      const [cfgJson, custJson, txnJson] = await Promise.all([cfgRes.json(), custRes.json(), txnRes.json()]);
      if (cfgJson.success) setConfig(cfgJson.data);
      if (custJson.success) setCustomers((custJson.data ?? []).sort((a: CustomerRow, b: CustomerRow) => b.loyaltyPoints - a.loyaltyPoints));
      if (txnJson.success) setTransactions(txnJson.data ?? []);
    } catch {
      toast.error('Failed to load loyalty data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !config) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-stone-400 text-sm">
        Loading loyalty data...
      </div>
    );
  }

  const totalPointsIssued = transactions.filter(t => t.type === 'EARN').reduce((s, t) => s + t.points, 0);
  const totalPointsRedeemed = Math.abs(transactions.filter(t => t.type === 'REDEEM').reduce((s, t) => s + t.points, 0));
  const activeMembers = customers.filter(c => c.loyaltyPoints > 0).length;
  const platinumCount = customers.filter(c => c.loyaltyPoints >= config.platinumThreshold).length;
  const goldCount = customers.filter(c => c.loyaltyPoints >= config.goldThreshold && c.loyaltyPoints < config.platinumThreshold).length;
  const silverCount = customers.filter(c => c.loyaltyPoints >= config.silverThreshold && c.loyaltyPoints < config.goldThreshold).length;

  const pointValueRs = config.pointValuePaise / 100;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-light pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-sm">
              <Gift size={18} />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-stone-800">Loyalty Programme</h1>
              <p className="text-xs text-stone-500 font-medium mt-0.5">
                {config.isEnabled
                  ? `Earn ${config.pointsPerHundred} pt per ₹100 · Redeem at ₹${pointValueRs.toFixed(2)}/pt`
                  : 'Programme is currently disabled'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!config.isEnabled && (
            <span className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-3 py-1.5 rounded-lg">
              Programme Disabled
            </span>
          )}
          <button
            onClick={fetchData}
            className="bg-white border border-border-light text-stone-600 text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 hover:bg-stone-50 transition-colors shadow-xs cursor-pointer"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Points Issued', value: totalPointsIssued.toLocaleString(), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Points Redeemed', value: totalPointsRedeemed.toLocaleString(), icon: Gift, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Active Members', value: activeMembers.toLocaleString(), icon: Users, color: 'text-brand', bg: 'bg-orange-50' },
          { label: 'Redemption Value', value: formatCurrency(totalPointsRedeemed * config.pointValuePaise), icon: Award, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-panel border border-border-light rounded-xl p-4 shadow-xs">
              <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center mb-2`}>
                <Icon size={15} className={card.color} />
              </div>
              <div className="font-display font-extrabold text-xl text-stone-900">{card.value}</div>
              <div className="text-[11px] text-stone-500 font-medium mt-0.5">{card.label}</div>
            </div>
          );
        })}
      </div>

      {/* Tier Breakdown + Top Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Tier Breakdown */}
        <div className="bg-panel border border-border-light rounded-xl p-4 shadow-xs space-y-3">
          <h2 className="text-xs font-bold text-stone-700 uppercase tracking-wide">Tier Breakdown</h2>
          {[
            { label: 'Platinum 💎', count: platinumCount, threshold: `${config.platinumThreshold}+ pts`, color: 'bg-purple-500' },
            { label: 'Gold 🥇', count: goldCount, threshold: `${config.goldThreshold}–${config.platinumThreshold - 1} pts`, color: 'bg-amber-500' },
            { label: 'Silver 🥈', count: silverCount, threshold: `${config.silverThreshold}–${config.goldThreshold - 1} pts`, color: 'bg-slate-400' },
            { label: 'Bronze 🥉', count: customers.filter(c => c.loyaltyPoints < config.silverThreshold).length, threshold: `0–${config.silverThreshold - 1} pts`, color: 'bg-orange-400' },
          ].map((tier) => (
            <div key={tier.label} className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${tier.color} shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-stone-800">{tier.label}</div>
                <div className="text-[10px] text-stone-400">{tier.threshold}</div>
              </div>
              <span className="font-bold text-sm text-stone-800">{tier.count}</span>
            </div>
          ))}
        </div>

        {/* Top Customers Leaderboard */}
        <div className="lg:col-span-2 bg-panel border border-border-light rounded-xl shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-border-light flex items-center justify-between">
            <h2 className="text-xs font-bold text-stone-700 uppercase tracking-wide">Top Members by Points</h2>
            <Star size={14} className="text-amber-400" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-400 font-semibold border-b border-border-light">
                  <th className="p-3">#</th>
                  <th className="p-3">CUSTOMER</th>
                  <th className="p-3 text-center">TIER</th>
                  <th className="p-3 text-right">POINTS</th>
                  <th className="p-3 text-right">VALUE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {customers.slice(0, 10).map((c, i) => {
                  const tier = getTier(c.loyaltyPoints, config);
                  return (
                    <tr key={c.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="p-3 text-stone-400 font-bold">#{i + 1}</td>
                      <td className="p-3">
                        <span className="font-bold text-stone-800 block">{c.name}</span>
                        {c.phone && <span className="text-[10px] text-stone-400">{c.phone}</span>}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tier.bg} ${tier.color}`}>
                          {tier.emoji} {tier.label}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-stone-800">{c.loyaltyPoints.toLocaleString()}</td>
                      <td className="p-3 text-right text-stone-600">{formatCurrency(c.loyaltyPoints * config.pointValuePaise)}</td>
                    </tr>
                  );
                })}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-stone-400">
                      <Gift size={28} className="mx-auto text-stone-200 mb-2" />
                      No loyalty members yet. Points are earned automatically on each purchase.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-panel border border-border-light rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-border-light">
          <h2 className="text-xs font-bold text-stone-700 uppercase tracking-wide">Recent Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50 text-stone-400 font-semibold border-b border-border-light">
                <th className="p-3">CUSTOMER</th>
                <th className="p-3">TYPE</th>
                <th className="p-3">BILL</th>
                <th className="p-3 text-right">POINTS</th>
                <th className="p-3 text-right">BALANCE AFTER</th>
                <th className="p-3">NOTE</th>
                <th className="p-3">DATE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-stone-400">No transactions yet</td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-stone-50/50">
                    <td className="p-3">
                      <span className="font-semibold text-stone-800">{t.customer.name}</span>
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        t.type === 'EARN'   ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        t.type === 'REDEEM' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        'bg-stone-100 text-stone-600 border border-stone-200'
                      }`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-stone-600">{t.sale?.billNumber ?? '—'}</td>
                    <td className={`p-3 text-right font-bold ${t.points > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {t.points > 0 ? '+' : ''}{t.points}
                    </td>
                    <td className="p-3 text-right text-stone-700 font-semibold">{t.balanceAfter.toLocaleString()}</td>
                    <td className="p-3 text-stone-500 max-w-[160px] truncate">{t.note ?? '—'}</td>
                    <td className="p-3 text-stone-400 whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
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