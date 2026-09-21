'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShoppingBag,
  Package,
  Receipt,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Sparkles,
  Gift,
  Warehouse,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

const NAV_ITEMS = [
  { href: '/billing', label: 'Billing Counter', icon: ShoppingBag, badge: 'POS' },
  { href: '/products', label: 'Products & Stock', icon: Package },
  { href: '/inventory', label: 'Inventory', icon: Warehouse, badge: 'NEW' },
  { href: '/sales', label: 'Sales & Bills', icon: Receipt },
  { href: '/reports', label: 'Shop Reports', icon: BarChart3 },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/loyalty', label: 'Loyalty Programme', icon: Gift },
  { href: '/settings', label: 'Shop Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <aside className="w-64 bg-sidebar border-r border-border-light flex flex-col justify-between shrink-0 h-screen select-none">
      <div>
        {/* Logo & Branding */}
        <div className="p-4 flex items-center justify-between border-b border-border-light">
          <Link href="/billing" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center text-white font-bold text-lg shadow-sm">
              <ShoppingBag size={18} />
            </div>
            <div>
              <span className="font-display font-bold text-base text-stone-800 tracking-tight block leading-tight">
                Billing OS
              </span>
              <span className="text-[10px] text-stone-400 font-medium tracking-wide">
                Retail &amp; Shop POS
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation links */}
        <div className="p-3 space-y-1">
          <div className="px-3 pt-2 pb-1.5 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
            Main Menu
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== '/billing' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                  active
                    ? 'bg-white shadow-xs text-stone-800 border border-border-light'
                    : 'text-stone-600 hover:bg-stone-200/50 hover:text-stone-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    size={16}
                    className={`transition-colors ${
                      active ? 'text-brand' : 'text-stone-400 group-hover:text-stone-600'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="bg-brand/10 text-brand text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* User profile card & Logout */}
      <div className="p-3 border-t border-border-light bg-stone-50/50">
        <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-border-light shadow-2xs">
          <div className="min-w-0 pr-2">
            <div className="font-semibold text-xs text-stone-800 truncate">
              {user?.name ?? 'Mohammed Shafi'}
            </div>
            <div className="text-[10px] text-stone-400 truncate flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              {user?.role ?? 'OWNER'} · Ameen Shop
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-stone-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
            title="Sign Out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
