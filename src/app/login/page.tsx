'use client';

import React, { useState } from 'react';
import { FileText, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth.store';

export default function LoginPage() {
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setUser(json.data.user);
        toast.success(`Welcome back, ${json.data.user.name}!`);
        // Navigate with full reload to ensure cookies and layout state initialize smoothly
        window.location.href = '/dashboard';
      } else {
        setError(json.error ?? 'Invalid email or password');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 p-4 font-sans">
      <div className="w-full max-w-md">
        {/* Glassmorphism card — matches POS login style */}
        <div className="bg-white/8 backdrop-blur-2xl rounded-2xl border border-white/15 shadow-2xl p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl bg-brand flex items-center justify-center shadow-lg mb-4"
              style={{ boxShadow: '0 8px 32px rgba(224,92,43,0.35)' }}
            >
              <FileText size={28} className="text-white" />
            </div>
            <h1 className="text-3xl font-display font-bold text-white tracking-tight">Billing OS</h1>
            <p className="text-stone-400 text-sm mt-1 font-medium">Professional Invoicing Platform</p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl mb-6 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-300 mb-1.5">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm placeholder:text-stone-600 focus:outline-none focus:border-brand/50 transition-colors"
                  placeholder="owner@acme.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-11 text-white text-sm placeholder:text-stone-600 focus:outline-none focus:border-brand/50 transition-colors"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-2.5 rounded-xl transition-colors mt-2 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Quick 1-click Demo Fill */}
          <div className="mt-6 pt-5 border-t border-white/10">
            <p className="text-xs text-stone-400 font-semibold mb-2 flex items-center gap-1.5">
              <Sparkles size={12} className="text-brand" /> Quick Demo Login:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleFillDemo('owner@acme.com', 'Admin@123')}
                className="bg-white/5 hover:bg-white/10 border border-white/10 text-stone-300 text-xs py-1.5 px-2.5 rounded-lg transition-colors text-left"
              >
                <span className="text-brand font-semibold block">Owner</span>
                <span className="text-[10px] text-stone-500">owner@acme.com</span>
              </button>
              <button
                type="button"
                onClick={() => handleFillDemo('accountant@acme.com', 'Admin@123')}
                className="bg-white/5 hover:bg-white/10 border border-white/10 text-stone-300 text-xs py-1.5 px-2.5 rounded-lg transition-colors text-left"
              >
                <span className="text-brand font-semibold block">Accountant</span>
                <span className="text-[10px] text-stone-500">accountant@acme.com</span>
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-stone-600 mt-6 font-medium">
          © {new Date().getFullYear()} Billing OS · Secure Environment
        </p>
      </div>
    </div>
  );
}
