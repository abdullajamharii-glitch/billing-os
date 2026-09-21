'use client';

import React, { useEffect, useState } from 'react';
import {
  Settings,
  Store,
  Printer,
  Save,
  Receipt,
  Gift,
  CreditCard,
  MessageSquare,
  Send,
  Zap,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

const inputCls =
  'w-full border border-border-light rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-brand/50 transition-colors bg-white';

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-stone-600 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-stone-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function ShopSettingsPage() {
  const [activeTab, setActiveTab] = useState<'store' | 'razorpay' | 'printer' | 'messaging' | 'loyalty'>('store');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 1. Store & GST Form
  const [storeForm, setStoreForm] = useState({
    name: '',
    phone: '',
    email: '',
    gstin: '',
    paperSize: '80mm',
    receiptHeader: '',
    receiptFooter: '',
    addressLine1: '',
    city: '',
    state: '',
    pincode: '',
    upiId: '',
  });

  // 2. Razorpay Form
  const [razorpayForm, setRazorpayForm] = useState({
    isEnabled: true,
    keyId: '',
    keySecret: '',
    webhookSecret: '',
    testMode: true,
  });

  // 3. Printer Form (ESC/POS)
  const [printerForm, setPrinterForm] = useState({
    printerType: 'BROWSER', // 'BROWSER' | 'NETWORK_ESC_POS'
    ipAddress: '',
    port: 9100,
    paperWidth: '80mm',
    autoCut: true,
    openCashDrawer: false,
  });
  const [testingPrinter, setTestingPrinter] = useState(false);

  // 4. Messaging Form (WhatsApp & SMS)
  const [messagingForm, setMessagingForm] = useState({
    provider: 'META_WHATSAPP', // 'META_WHATSAPP' | 'GUPSHUP' | 'SMS'
    metaPhoneNumberId: '',
    metaAccessToken: '',
    gupshupApiKey: '',
    gupshupAppName: '',
    smsApiKey: '',
    autoSendBill: false,
    testRecipient: '',
  });
  const [testingMessage, setTestingMessage] = useState(false);

  // 5. Loyalty Form
  const [loyaltyForm, setLoyaltyForm] = useState({
    isEnabled: true,
    pointsPerHundred: 1,
    pointValuePaise: 50,
    minPointsRedeem: 50,
    silverThreshold: 500,
    goldThreshold: 2000,
    platinumThreshold: 5000,
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/org').then((r) => r.json()),
      fetch('/api/v1/loyalty/config').then((r) => r.json()),
    ])
      .then(([orgRes, loyaltyRes]) => {
        if (orgRes.data) {
          const d = orgRes.data;
          setStoreForm({
            name: d.name ?? '',
            phone: d.phone ?? '',
            email: d.email ?? '',
            gstin: d.gstin ?? '',
            paperSize: d.paperSize ?? '80mm',
            receiptHeader: d.receiptHeader ?? '',
            receiptFooter: d.receiptFooter ?? '',
            addressLine1: d.address?.line1 ?? '',
            city: d.address?.city ?? '',
            state: d.address?.state ?? '',
            pincode: d.address?.pincode ?? '',
            upiId: d.bankDetails?.upiId ?? '',
          });

          if (d.razorpayConfig) {
            setRazorpayForm((prev) => ({ ...prev, ...d.razorpayConfig }));
          }
          if (d.printerConfig) {
            setPrinterForm((prev) => ({ ...prev, ...d.printerConfig }));
          }
          if (d.messagingConfig) {
            setMessagingForm((prev) => ({ ...prev, ...d.messagingConfig }));
          }
        }

        if (loyaltyRes.data) {
          setLoyaltyForm({
            isEnabled: loyaltyRes.data.isEnabled ?? true,
            pointsPerHundred: loyaltyRes.data.pointsPerHundred ?? 1,
            pointValuePaise: loyaltyRes.data.pointValuePaise ?? 50,
            minPointsRedeem: loyaltyRes.data.minPointsRedeem ?? 50,
            silverThreshold: loyaltyRes.data.silverThreshold ?? 500,
            goldThreshold: loyaltyRes.data.goldThreshold ?? 2000,
            platinumThreshold: loyaltyRes.data.platinumThreshold ?? 5000,
          });
        }
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  // Save Store & Integration Settings
  const handleSaveAll = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: storeForm.name,
        phone: storeForm.phone || null,
        email: storeForm.email || null,
        gstin: storeForm.gstin || null,
        paperSize: printerForm.paperWidth || storeForm.paperSize,
        receiptHeader: storeForm.receiptHeader || null,
        receiptFooter: storeForm.receiptFooter || null,
        address: {
          line1: storeForm.addressLine1,
          city: storeForm.city,
          state: storeForm.state,
          pincode: storeForm.pincode,
        },
        bankDetails: {
          upiId: storeForm.upiId,
        },
        razorpayConfig: razorpayForm,
        printerConfig: printerForm,
        messagingConfig: messagingForm,
      };

      const [orgRes, loyaltyRes] = await Promise.all([
        fetch('/api/v1/org', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
        fetch('/api/v1/loyalty/config', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loyaltyForm),
        }),
      ]);

      if (orgRes.ok && loyaltyRes.ok) {
        toast.success('All settings saved successfully!');
      } else {
        toast.error('Failed to save some settings');
      }
    } catch {
      toast.error('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  // Test ESC/POS Printer
  const handleTestPrinter = async () => {
    if (!printerForm.ipAddress) {
      toast.error('Please enter the Printer IP address');
      return;
    }
    setTestingPrinter(true);
    try {
      const res = await fetch('/api/v1/print/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(printerForm),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`Printer test sent to ${printerForm.ipAddress}:${printerForm.port}!`);
      } else {
        toast.error(json.error || 'Printer connection failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Printer test failed');
    } finally {
      setTestingPrinter(false);
    }
  };

  // Test WhatsApp / SMS Notification
  const handleTestNotification = async () => {
    if (!messagingForm.testRecipient) {
      toast.error('Please enter a test recipient mobile number');
      return;
    }
    setTestingMessage(true);
    try {
      const res = await fetch('/api/v1/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: messagingForm.provider === 'SMS' ? 'SMS' : 'WHATSAPP',
          provider: messagingForm.provider,
          recipientPhone: messagingForm.testRecipient,
          apiKey: messagingForm.gupshupApiKey || messagingForm.smsApiKey,
          token: messagingForm.metaAccessToken,
          phoneNumberId: messagingForm.metaPhoneNumberId,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`Test message dispatched to ${messagingForm.testRecipient}!`);
      } else {
        toast.error(json.error || 'Test dispatch failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Notification test error');
    } finally {
      setTestingMessage(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand/30 border-t-brand rounded-full animate-spin" />
      </div>
    );
  }

  const TABS = [
    { id: 'store', label: 'Store & GST Profile', icon: Store },
    { id: 'razorpay', label: 'Razorpay Payments', icon: CreditCard },
    { id: 'printer', label: 'ESC/POS Thermal Print', icon: Printer },
    { id: 'messaging', label: 'WhatsApp & SMS', icon: MessageSquare },
    { id: 'loyalty', label: 'Loyalty Programme', icon: Gift },
  ] as const;

  return (
    <div className="space-y-6 max-w-4xl pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-stone-900 flex items-center gap-2">
            <Settings size={22} className="text-brand" /> Shop & Hardware Settings
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Configure POS peripherals, Razorpay UPI, ESC/POS LAN printers, and WhatsApp receipts
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleSaveAll()}
          disabled={saving}
          className="bg-brand hover:bg-brand-dark text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-60 shrink-0 self-start sm:self-auto"
        >
          {saving ? (
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save size={14} />
          )}
          <span>Save All Settings</span>
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 p-1 bg-stone-200/60 rounded-xl overflow-x-auto text-xs font-semibold">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-white text-brand font-bold shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-white/40'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: STORE & GST COMPLIANCE */}
      {activeTab === 'store' && (
        <div className="bg-panel border border-border-light rounded-2xl p-6 space-y-6 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-border-light pb-3">
            <h2 className="font-display font-bold text-base text-stone-800 flex items-center gap-2">
              <Store size={18} className="text-brand" /> Store Identity & GST Compliance
            </h2>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
              Rule 46 Compliant
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Shop / Restaurant Name">
              <input
                type="text"
                value={storeForm.name}
                onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
                className={inputCls}
                placeholder="e.g. Fried Zone"
              />
            </Field>

            <Field label="Contact Phone">
              <input
                type="tel"
                value={storeForm.phone}
                onChange={(e) => setStoreForm({ ...storeForm, phone: e.target.value })}
                className={inputCls}
                placeholder="+91 7909 303 909"
              />
            </Field>

            <Field label="Contact Email">
              <input
                type="email"
                value={storeForm.email}
                onChange={(e) => setStoreForm({ ...storeForm, email: e.target.value })}
                className={inputCls}
                placeholder="billing@friedzone.com"
              />
            </Field>

            <Field label="GSTIN (15-digit Tax ID)" hint="Printed on tax invoices & used for CGST/SGST state split">
              <input
                type="text"
                value={storeForm.gstin}
                onChange={(e) => setStoreForm({ ...storeForm, gstin: e.target.value.toUpperCase() })}
                className={`${inputCls} font-mono uppercase`}
                placeholder="32AAAAA0000A1Z5"
              />
            </Field>

            <Field label="Static UPI ID for QR">
              <input
                type="text"
                value={storeForm.upiId}
                onChange={(e) => setStoreForm({ ...storeForm, upiId: e.target.value })}
                className={inputCls}
                placeholder="friedzone@okaxis"
              />
            </Field>

            <Field label="Default Restaurant SAC Code">
              <input
                type="text"
                readOnly
                value="996331 (Restaurant & Eating Facility Services - 5% GST)"
                className={`${inputCls} bg-stone-50 text-stone-500 font-mono`}
              />
            </Field>
          </div>

          <div className="border-t border-border-light pt-4 space-y-4">
            <h3 className="font-bold text-xs text-stone-700">Physical Address</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-3">
                <input
                  type="text"
                  value={storeForm.addressLine1}
                  onChange={(e) => setStoreForm({ ...storeForm, addressLine1: e.target.value })}
                  className={inputCls}
                  placeholder="Street / Building Address"
                />
              </div>
              <input
                type="text"
                value={storeForm.city}
                onChange={(e) => setStoreForm({ ...storeForm, city: e.target.value })}
                className={inputCls}
                placeholder="City"
              />
              <input
                type="text"
                value={storeForm.state}
                onChange={(e) => setStoreForm({ ...storeForm, state: e.target.value })}
                className={inputCls}
                placeholder="State (e.g. Kerala)"
              />
              <input
                type="text"
                value={storeForm.pincode}
                onChange={(e) => setStoreForm({ ...storeForm, pincode: e.target.value })}
                className={inputCls}
                placeholder="Pincode"
              />
            </div>
          </div>

          <div className="border-t border-border-light pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Receipt Header Text">
              <input
                type="text"
                value={storeForm.receiptHeader}
                onChange={(e) => setStoreForm({ ...storeForm, receiptHeader: e.target.value })}
                className={inputCls}
                placeholder="Text displayed below shop title"
              />
            </Field>
            <Field label="Receipt Footer Note">
              <input
                type="text"
                value={storeForm.receiptFooter}
                onChange={(e) => setStoreForm({ ...storeForm, receiptFooter: e.target.value })}
                className={inputCls}
                placeholder="Thank you for dining with us! Visit again."
              />
            </Field>
          </div>
        </div>
      )}

      {/* TAB 2: RAZORPAY PAYMENTS */}
      {activeTab === 'razorpay' && (
        <div className="bg-panel border border-border-light rounded-2xl p-6 space-y-5 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-border-light pb-3">
            <div>
              <h2 className="font-display font-bold text-base text-stone-800 flex items-center gap-2">
                <CreditCard size={18} className="text-brand" /> Razorpay POS & Dynamic UPI QR
              </h2>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Generates live dynamic UPI QR codes on the counter for instant customer scanning (GPay, PhonePe, Paytm)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-stone-600">Enabled</span>
              <button
                type="button"
                onClick={() => setRazorpayForm({ ...razorpayForm, isEnabled: !razorpayForm.isEnabled })}
                className={`relative w-10 h-5.5 rounded-full transition-colors cursor-pointer ${
                  razorpayForm.isEnabled ? 'bg-emerald-500' : 'bg-stone-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-all ${
                    razorpayForm.isEnabled ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Zap size={13} className="text-amber-600" /> Mode Switch
            </div>
            <div className="flex items-center justify-between">
              <span>
                {razorpayForm.testMode
                  ? '⚡ Simulation / Test Mode active: Generates authentic UPI QRs without requiring live Razorpay API keys.'
                  : '🔒 Live Production Mode: Real orders created via Razorpay Orders API.'}
              </span>
              <button
                type="button"
                onClick={() => setRazorpayForm({ ...razorpayForm, testMode: !razorpayForm.testMode })}
                className="text-[11px] font-bold bg-amber-200/80 hover:bg-amber-300/80 text-amber-900 px-2.5 py-1 rounded-lg cursor-pointer"
              >
                Switch to {razorpayForm.testMode ? 'Live Mode' : 'Test Mode'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Razorpay Key ID" hint="Find in Razorpay Dashboard > Settings > API Keys">
              <input
                type="text"
                value={razorpayForm.keyId || ''}
                onChange={(e) => setRazorpayForm({ ...razorpayForm, keyId: e.target.value })}
                className={`${inputCls} font-mono`}
                placeholder="rzp_test_..."
              />
            </Field>

            <Field label="Razorpay Key Secret">
              <input
                type="password"
                value={razorpayForm.keySecret || ''}
                onChange={(e) => setRazorpayForm({ ...razorpayForm, keySecret: e.target.value })}
                className={`${inputCls} font-mono`}
                placeholder="••••••••••••••••"
              />
            </Field>

            <Field label="Razorpay Webhook Secret" hint="Used to verify webhook authenticity">
              <input
                type="password"
                value={razorpayForm.webhookSecret || ''}
                onChange={(e) => setRazorpayForm({ ...razorpayForm, webhookSecret: e.target.value })}
                className={`${inputCls} font-mono`}
                placeholder="Optional webhook secret"
              />
            </Field>

            <Field label="Webhook Endpoint URL (to enter in Razorpay)">
              <input
                type="text"
                readOnly
                value="http://localhost:3001/api/v1/payments/razorpay/webhook"
                className={`${inputCls} bg-stone-50 font-mono text-stone-500`}
              />
            </Field>
          </div>
        </div>
      )}

      {/* TAB 3: ESC/POS THERMAL PRINTER */}
      {activeTab === 'printer' && (
        <div className="bg-panel border border-border-light rounded-2xl p-6 space-y-5 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-border-light pb-3">
            <div>
              <h2 className="font-display font-bold text-base text-stone-800 flex items-center gap-2">
                <Printer size={18} className="text-brand" /> ESC/POS Hardware Thermal Printing
              </h2>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Stream raw ESC/POS command buffers directly to TVS, Epson, Rongta, Everycom thermal printers over LAN / Wi-Fi
              </p>
            </div>
            <button
              type="button"
              onClick={handleTestPrinter}
              disabled={testingPrinter || printerForm.printerType === 'BROWSER'}
              className="bg-stone-800 hover:bg-stone-900 disabled:opacity-40 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {testingPrinter ? (
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Printer size={13} />
              )}
              <span>⚡ Test Print Slip</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Printing Mode">
              <select
                value={printerForm.printerType}
                onChange={(e) => setPrinterForm({ ...printerForm, printerType: e.target.value })}
                className={inputCls}
              >
                <option value="BROWSER">Browser Print Dialog (USB / Default OS Printer)</option>
                <option value="NETWORK_ESC_POS">Direct Network ESC/POS (LAN / Wi-Fi Socket IP:9100)</option>
              </select>
            </Field>

            <Field label="Paper Roll Width">
              <select
                value={printerForm.paperWidth}
                onChange={(e) => setPrinterForm({ ...printerForm, paperWidth: e.target.value as any })}
                className={inputCls}
              >
                <option value="80mm">80mm (Standard 3-inch, 48 characters)</option>
                <option value="58mm">58mm (Compact 2-inch, 32 characters)</option>
              </select>
            </Field>

            {printerForm.printerType === 'NETWORK_ESC_POS' && (
              <>
                <Field label="Printer Local IP Address" hint="e.g. 192.168.1.200 (Assigned to your thermal printer on Wi-Fi/LAN)">
                  <input
                    type="text"
                    value={printerForm.ipAddress}
                    onChange={(e) => setPrinterForm({ ...printerForm, ipAddress: e.target.value })}
                    className={`${inputCls} font-mono`}
                    placeholder="192.168.1.200"
                  />
                </Field>

                <Field label="Raw Print Port" hint="Default raw jetdirect port is 9100">
                  <input
                    type="number"
                    value={printerForm.port}
                    onChange={(e) => setPrinterForm({ ...printerForm, port: parseInt(e.target.value) || 9100 })}
                    className={`${inputCls} font-mono`}
                    placeholder="9100"
                  />
                </Field>
              </>
            )}
          </div>

          <div className="border-t border-border-light pt-3 flex items-center gap-6">
            <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={printerForm.autoCut}
                onChange={(e) => setPrinterForm({ ...printerForm, autoCut: e.target.checked })}
                className="rounded text-brand"
              />
              <span>Send Paper Cut Command (GS V)</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={printerForm.openCashDrawer}
                onChange={(e) => setPrinterForm({ ...printerForm, openCashDrawer: e.target.checked })}
                className="rounded text-brand"
              />
              <span>Kick Cash Drawer Open (ESC p)</span>
            </label>
          </div>
        </div>
      )}

      {/* TAB 4: WHATSAPP & SMS */}
      {activeTab === 'messaging' && (
        <div className="bg-panel border border-border-light rounded-2xl p-6 space-y-5 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-border-light pb-3">
            <div>
              <h2 className="font-display font-bold text-base text-stone-800 flex items-center gap-2">
                <MessageSquare size={18} className="text-brand" /> WhatsApp & SMS Digital Invoicing
              </h2>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Send structured digital bills and loyalty points directly to the customer's phone
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={messagingForm.autoSendBill}
                onChange={(e) => setMessagingForm({ ...messagingForm, autoSendBill: e.target.checked })}
                className="rounded text-brand"
              />
              <span>Auto-send on Checkout</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Primary Delivery Provider">
              <select
                value={messagingForm.provider}
                onChange={(e) => setMessagingForm({ ...messagingForm, provider: e.target.value })}
                className={inputCls}
              >
                <option value="META_WHATSAPP">Meta WhatsApp Business Cloud API (Official)</option>
                <option value="GUPSHUP">Gupshup WhatsApp API</option>
                <option value="SMS">Fast2SMS / MSG91 (Plain SMS)</option>
              </select>
            </Field>

            {messagingForm.provider === 'META_WHATSAPP' && (
              <>
                <Field label="Meta Phone Number ID" hint="Found in Meta App Dashboard > WhatsApp > Getting Started">
                  <input
                    type="text"
                    value={messagingForm.metaPhoneNumberId}
                    onChange={(e) => setMessagingForm({ ...messagingForm, metaPhoneNumberId: e.target.value })}
                    className={`${inputCls} font-mono`}
                    placeholder="104928491823910"
                  />
                </Field>

                <Field label="Meta Access Token (Bearer)">
                  <input
                    type="password"
                    value={messagingForm.metaAccessToken}
                    onChange={(e) => setMessagingForm({ ...messagingForm, metaAccessToken: e.target.value })}
                    className={`${inputCls} font-mono`}
                    placeholder="EAABw..."
                  />
                </Field>
              </>
            )}

            {messagingForm.provider === 'GUPSHUP' && (
              <>
                <Field label="Gupshup API Key">
                  <input
                    type="password"
                    value={messagingForm.gupshupApiKey}
                    onChange={(e) => setMessagingForm({ ...messagingForm, gupshupApiKey: e.target.value })}
                    className={`${inputCls} font-mono`}
                    placeholder="apikey_..."
                  />
                </Field>
                <Field label="Gupshup App Name">
                  <input
                    type="text"
                    value={messagingForm.gupshupAppName}
                    onChange={(e) => setMessagingForm({ ...messagingForm, gupshupAppName: e.target.value })}
                    className={inputCls}
                    placeholder="FriedZoneApp"
                  />
                </Field>
              </>
            )}

            {messagingForm.provider === 'SMS' && (
              <Field label="SMS API Key (Fast2SMS / MSG91)">
                <input
                  type="password"
                  value={messagingForm.smsApiKey}
                  onChange={(e) => setMessagingForm({ ...messagingForm, smsApiKey: e.target.value })}
                  className={`${inputCls} font-mono`}
                  placeholder="SMS API authorization key"
                />
              </Field>
            )}
          </div>

          {/* Test Dispatch Bar */}
          <div className="border-t border-border-light pt-4 flex flex-col sm:flex-row items-center gap-3">
            <input
              type="tel"
              value={messagingForm.testRecipient}
              onChange={(e) => setMessagingForm({ ...messagingForm, testRecipient: e.target.value })}
              className={`${inputCls} sm:max-w-xs`}
              placeholder="Test mobile no. (e.g. 9845012345)"
            />
            <button
              type="button"
              onClick={handleTestNotification}
              disabled={testingMessage}
              className="bg-stone-800 hover:bg-stone-900 disabled:opacity-40 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              {testingMessage ? (
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send size={12} />
              )}
              <span>Send Test Notification</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: LOYALTY PROGRAMME */}
      {activeTab === 'loyalty' && (
        <div className="bg-panel border border-border-light rounded-2xl p-6 space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-border-light pb-3">
            <div>
              <h2 className="font-display font-bold text-base text-stone-800 flex items-center gap-2">
                <Gift size={18} className="text-amber-500" /> Customer Loyalty Rewards
              </h2>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Reward returning customers with points and allow POS discounts
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLoyaltyForm({ ...loyaltyForm, isEnabled: !loyaltyForm.isEnabled })}
              className={`relative w-10 h-5.5 rounded-full transition-colors cursor-pointer ${
                loyaltyForm.isEnabled ? 'bg-emerald-500' : 'bg-stone-300'
              }`}
            >
              <span
                className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-all ${
                  loyaltyForm.isEnabled ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Points Earned per ₹100 Spent">
              <input
                type="number"
                min={0}
                max={100}
                value={loyaltyForm.pointsPerHundred}
                onChange={(e) => setLoyaltyForm({ ...loyaltyForm, pointsPerHundred: parseInt(e.target.value) || 0 })}
                className={inputCls}
              />
            </Field>
            <Field label="Redeem Value per Point (paise)">
              <input
                type="number"
                min={1}
                value={loyaltyForm.pointValuePaise}
                onChange={(e) => setLoyaltyForm({ ...loyaltyForm, pointValuePaise: parseInt(e.target.value) || 1 })}
                className={inputCls}
              />
            </Field>
            <Field label="Min Points to Redeem">
              <input
                type="number"
                min={0}
                value={loyaltyForm.minPointsRedeem}
                onChange={(e) => setLoyaltyForm({ ...loyaltyForm, minPointsRedeem: parseInt(e.target.value) || 0 })}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="pt-2 border-t border-border-light">
            <p className="text-xs font-semibold text-stone-600 mb-2">Loyalty Tier Thresholds</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: '🥉 Bronze', key: null, value: 0, disabled: true },
                { label: '🥈 Silver', key: 'silverThreshold', value: loyaltyForm.silverThreshold },
                { label: '🥇 Gold', key: 'goldThreshold', value: loyaltyForm.goldThreshold },
                { label: '💎 Platinum', key: 'platinumThreshold', value: loyaltyForm.platinumThreshold },
              ].map((tier) => (
                <div key={tier.label}>
                  <label className="block text-[10px] font-semibold text-stone-500 mb-1">{tier.label}</label>
                  <input
                    type="number"
                    min={0}
                    value={tier.value}
                    disabled={tier.disabled}
                    onChange={(e) =>
                      tier.key && setLoyaltyForm({ ...loyaltyForm, [tier.key]: parseInt(e.target.value) || 0 })
                    }
                    className={`${inputCls} ${tier.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
