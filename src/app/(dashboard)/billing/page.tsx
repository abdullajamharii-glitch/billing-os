'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  Printer,
  CreditCard,
  Banknote,
  QrCode,
  X,
  CheckCircle,
  User,
  ShoppingBag,
  Sparkles,
  Percent,
  RefreshCw,
  Layers,
  Zap,
  Gift,
  Phone,
  UserPlus,
  ArrowRight,
  Award,
  MessageSquare,
  Send,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useShopPOSStore } from '@/store/shop-pos.store';
import { formatCurrency, paiseToRupees, rupeesToPaise, bpsToPercent } from '@/lib/money';
import { ThermalReceiptEngine } from '@/lib/thermal-receipt';

interface Category {
  id: string;
  name: string;
  color?: string;
}

interface Product {
  id: string;
  name: string;
  barcode?: string;
  price: number; // paise
  costPrice: number;
  stock: number;
  minStock: number;
  unit: string;
  taxRate: number; // bps
  categoryId?: string;
}

export default function BillingCounterPage() {
  const {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    customerName,
    customerPhone,
    customerId,
    loyaltyBalance,
    pointsToRedeem,
    setCustomer,
    setPointsToRedeem,
    discountTotal,
    setDiscountTotal,
    paymentMethod,
    setPaymentMethod,
    cashReceived,
    setCashReceived,
    getTotals,
  } = useShopPOSStore();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Loyalty config (fetched once on mount)
  const [loyaltyConfig, setLoyaltyConfig] = useState<{ isEnabled: boolean; pointValuePaise: number; minPointsRedeem: number } | null>(null);

  // Dialogs
  const [showPayModal, setShowPayModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountPercentInput, setDiscountPercentInput] = useState('');
  const [submittingBill, setSubmittingBill] = useState(false);

  // Completed Bill / Thermal Print state
  const [completedBill, setCompletedBill] = useState<any | null>(null);
  const [receiptHtml, setReceiptHtml] = useState<string | null>(null);
  // Fast Turbo Mode: skips system print dialog and screen popup for rush hour queues
  const [fastMode, setFastMode] = useState(true);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const customerPhoneInputRef = useRef<HTMLInputElement>(null);
  const newCustomerNameInputRef = useRef<HTMLInputElement>(null);

  // Quick Customer Capture state
  const [quickPhoneInput, setQuickPhoneInput] = useState('');
  const [quickNameInput, setQuickNameInput] = useState('');
  const [quickSearching, setQuickSearching] = useState(false);
  const [showQuickNewCustomer, setShowQuickNewCustomer] = useState(false);

  const getCustomerTier = (pts: number) => {
    if (pts >= 5000) return { label: 'Platinum', emoji: '💎', cls: 'bg-purple-50 text-purple-700 border-purple-200' };
    if (pts >= 2000) return { label: 'Gold', emoji: '🥇', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    if (pts >= 500)  return { label: 'Silver', emoji: '🥈', cls: 'bg-slate-50 text-slate-700 border-slate-200' };
    if (pts > 0)     return { label: 'Bronze', emoji: '🥉', cls: 'bg-orange-50 text-orange-700 border-orange-200' };
    return null;
  };

  const handleQuickCustomerLookup = async (phoneToSearch: string) => {
    const clean = phoneToSearch.trim();
    if (clean.length < 3) return;
    setQuickSearching(true);
    try {
      const res = await fetch(`/api/v1/customers?search=${encodeURIComponent(clean)}&pageSize=5`);
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        const exact = json.data.find((c: any) => c.phone && c.phone.replace(/\D/g, '').endsWith(clean.replace(/\D/g, ''))) || json.data[0];
        setCustomer(exact.name, exact.phone || clean, exact.id, exact.loyaltyPoints || 0);
        setShowQuickNewCustomer(false);
        setQuickPhoneInput('');
        setQuickNameInput('');
        toast.success(`Linked: ${exact.name} (${exact.loyaltyPoints || 0} pts)`, { icon: '👤' });
        setTimeout(() => barcodeInputRef.current?.focus(), 50);
      } else {
        setShowQuickNewCustomer(true);
        setTimeout(() => newCustomerNameInputRef.current?.focus(), 50);
      }
    } catch {
      setShowQuickNewCustomer(true);
    } finally {
      setQuickSearching(false);
    }
  };

  const handleCreateAndLinkQuickCustomer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const phone = quickPhoneInput.trim();
    const name = quickNameInput.trim() || (phone ? `Customer ${phone.slice(-4)}` : 'Walk-in Customer');

    if (!phone && name === 'Walk-in Customer') {
      setShowQuickNewCustomer(false);
      return;
    }

    try {
      const res = await fetch('/api/v1/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setCustomer(json.data.name, json.data.phone || phone, json.data.id, json.data.loyaltyPoints || 0);
        toast.success(`Enrolled & Linked: ${json.data.name}`, { icon: '✨' });
      } else {
        setCustomer(name, phone, null, 0);
        toast.success(`Customer set: ${name}`);
      }
    } catch {
      setCustomer(name, phone, null, 0);
    } finally {
      setShowQuickNewCustomer(false);
      setQuickPhoneInput('');
      setQuickNameInput('');
      setTimeout(() => barcodeInputRef.current?.focus(), 50);
    }
  };

  const handleResetToWalkIn = () => {
    setCustomer('Walk-in Customer', '', null, 0);
    setShowQuickNewCustomer(false);
    setQuickPhoneInput('');
    setQuickNameInput('');
    toast('Customer set to Walk-in', { icon: '🚶' });
    setTimeout(() => barcodeInputRef.current?.focus(), 50);
  };

  // Razorpay Dynamic QR state
  const [dynamicQrOrder, setDynamicQrOrder] = useState<{
    orderId: string;
    qrCodeDataUrl: string;
    amount: number;
    isTestMode: boolean;
  } | null>(null);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [pollingPayment, setPollingPayment] = useState(false);

  // WhatsApp & ESC/POS actions state
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [printingEscPos, setPrintingEscPos] = useState(false);

  // Generate dynamic Razorpay UPI QR for POS
  const handleGenerateRazorpayQr = async () => {
    if (totals.grandTotal <= 0) return;
    setGeneratingQr(true);
    try {
      const res = await fetch('/api/v1/payments/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountPaise: totals.grandTotal,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setDynamicQrOrder(json.data);
        setPollingPayment(true);
        toast.success('Dynamic UPI QR Generated! Scan to Pay', { icon: '📱' });
      } else {
        toast.error(json.error || 'Failed to create UPI QR');
      }
    } catch {
      toast.error('Error generating Razorpay QR');
    } finally {
      setGeneratingQr(false);
    }
  };

  // Poll Razorpay order status while QR is displayed
  useEffect(() => {
    if (!dynamicQrOrder || !pollingPayment || !showPayModal) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/payments/razorpay/status/${dynamicQrOrder.orderId}`);
        const json = await res.json();
        if (json.success && json.data?.status === 'paid') {
          clearInterval(interval);
          setPollingPayment(false);
          toast.success('Payment Received via UPI! Finalizing bill...', { icon: '✅' });
          handleCheckout('UPI', totals.grandTotal);
        }
      } catch {}
    }, 2500);

    return () => clearInterval(interval);
  }, [dynamicQrOrder, pollingPayment, showPayModal]);

  // Send WhatsApp receipt
  const handleSendWhatsAppReceipt = async (saleId: string, phone?: string | null) => {
    const targetPhone = phone || activeCustomerPhone;
    if (!targetPhone || targetPhone.trim().length < 5) {
      toast.error('Customer phone number required to send WhatsApp bill');
      return;
    }
    setSendingWhatsApp(true);
    try {
      const res = await fetch('/api/v1/notifications/send-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleId,
          recipientPhone: targetPhone,
          channel: 'WHATSAPP',
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`WhatsApp receipt sent to ${targetPhone}!`, { icon: '💬' });
      } else {
        toast.error(json.error || 'Failed to send WhatsApp receipt');
      }
    } catch {
      toast.error('Error dispatching WhatsApp bill');
    } finally {
      setSendingWhatsApp(false);
    }
  };

  // Direct Network ESC/POS Print
  const handleDirectEscPosPrint = async (saleId: string) => {
    setPrintingEscPos(true);
    try {
      const res = await fetch('/api/v1/print/escpos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success('Bill sent to ESC/POS thermal printer!', { icon: '🖨️' });
      } else {
        toast.error(json.error || 'ESC/POS print failed. Falling back to browser print.');
        if (receiptHtml) printReceiptDirectly(receiptHtml);
      }
    } catch (err: any) {
      toast.error(err.message || 'ESC/POS connection error');
    } finally {
      setPrintingEscPos(false);
    }
  };

  // SSR Hydration safety for persisted Zustand store
  const [mounted, setMounted] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  // Inline quantity editing in cart
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineEditVal, setInlineEditVal] = useState('');
  // POS stock refresh state
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('pos_fast_mode');
      if (saved !== null) {
        setFastMode(saved === 'true');
      }
    } catch (_) {}
    // Auto-focus search / barcode input immediately on mount
    const timer = setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 100);
    // Fetch loyalty config
    fetch('/api/v1/loyalty/config').then(r => r.json()).then(j => {
      if (j.success && j.data) setLoyaltyConfig(j.data);
    }).catch(() => {});
    return () => clearTimeout(timer);
  }, []);

  // Whenever modals close, automatically return focus to the search / barcode box
  useEffect(() => {
    if (!showPayModal && !showCustomerModal && !showDiscountModal && !completedBill) {
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 80);
    }
  }, [showPayModal, showCustomerModal, showDiscountModal, completedBill]);

  // Reset highlight to the first item whenever the search query or category changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery, activeCategoryId]);

  const activeCart = mounted ? cart : [];
  const activeCustomerName = mounted ? customerName : 'Walk-in Customer';
  const activeCustomerPhone = mounted ? customerPhone : '';
  const totals = mounted
    ? getTotals()
    : { itemCount: 0, subtotal: 0, taxTotal: 0, discountTotal: 0, grandTotal: 0, changeReturned: 0 };

  // Load categories & products (also called on F5 refresh)
  const refreshProducts = async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const [catJson, prodJson] = await Promise.all([
        fetch('/api/v1/categories').then((r) => r.json()),
        fetch('/api/v1/products?pageSize=200').then((r) => r.json()),
      ]);
      setCategories(catJson.data ?? []);
      setProducts(prodJson.data ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setTimeout(() => barcodeInputRef.current?.focus(), 150);
    }
  };

  useEffect(() => {
    refreshProducts();
  }, []);

  // Filter products by category & search
  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      activeCategoryId === 'all' || p.categoryId === activeCategoryId;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      p.name.toLowerCase().includes(query) ||
      (p.barcode && p.barcode.toLowerCase().includes(query));
    return matchesCategory && matchesSearch;
  });

  // Handle direct Barcode / SKU scanning or Enter press -> Auto-select first or matching item!
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim().toLowerCase();

    // If search box is empty and cart has items -> pressing Enter prints the bill directly!
    if (!query) {
      if (activeCart.length > 0 && !submittingBill) {
        handleCheckout('CASH', totals.grandTotal);
      }
      return;
    }

    // @ prefix shortcut: @phone jumps straight to customer lookup (e.g. @9876543210)
    if (searchQuery.trim().startsWith('@')) {
      const phoneStr = searchQuery.trim().slice(1);
      setSearchQuery('');
      if (phoneStr) {
        setQuickPhoneInput(phoneStr);
        handleQuickCustomerLookup(phoneStr);
      } else {
        customerPhoneInputRef.current?.focus();
      }
      return;
    }

    // 1. Check exact barcode match first
    let matched = products.find((p) => p.barcode?.toLowerCase() === query);

    // 2. Check exact name match
    if (!matched) {
      matched = products.find((p) => p.name.toLowerCase() === query);
    }

    // 3. Auto-select highlighted item or the very first item from filtered search results!
    if (!matched && filteredProducts.length > 0) {
      const idx =
        highlightedIndex >= 0 && highlightedIndex < filteredProducts.length
          ? highlightedIndex
          : 0;
      matched = filteredProducts[idx];
    }

    if (matched) {
      if (matched.stock <= 0) {
        toast.error(`${matched.name} is out of stock!`);
        return;
      }
      addToCart(matched);
      toast.success(`Added ${matched.name}`);
      setSearchQuery('');
      setHighlightedIndex(0);
      barcodeInputRef.current?.focus();
    } else {
      toast.error(`No product found matching "${searchQuery}"`);
    }
  };

  // Keyboard navigation for search input: Down/Up to navigate filtered products, Enter on empty to Print
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If Enter pressed on empty search input and cart has items -> Quick Print!
    if (e.key === 'Enter' && !searchQuery.trim() && activeCart.length > 0 && !submittingBill) {
      e.preventDefault();
      handleCheckout('CASH', totals.grandTotal);
      return;
    }

    if (filteredProducts.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % filteredProducts.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + filteredProducts.length) % filteredProducts.length);
    }
  };

  // Quick cash buttons helper
  const handleQuickCash = (rupees: number) => {
    setCashReceived(rupeesToPaise(rupees));
  };

  // Direct thermal receipt printing using safe HTML5 srcdoc without document.write or popup blockers
  const printReceiptDirectly = (htmlContent: string) => {
    try {
      let iframe = document.getElementById('receipt-print-iframe') as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'receipt-print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '1px';
        iframe.style.height = '1px';
        iframe.style.border = '0';
        iframe.style.opacity = '0.01';
        iframe.style.pointerEvents = 'none';
        document.body.appendChild(iframe);
      }
      // Use srcdoc instead of doc.write to prevent Chromium document.write violations
      iframe.srcdoc = htmlContent;
      iframe.onload = () => {
        try {
          setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          }, 100);
        } catch (printErr) {
          console.warn('Iframe print call suppressed by browser:', printErr);
        }
      };
    } catch (e) {
      console.warn('Direct print setup warning:', e);
    }
  };

  const handleCloseReceiptAndNewSale = () => {
    setCompletedBill(null);
    setReceiptHtml(null);
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 80);
  };

  // Global Keyboard shortcuts for 100% mouse-free POS operations (F12, Ctrl+Enter, F9, F8, Esc, Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. If Bill Preview is showing:
      if (completedBill) {
        if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
          e.preventDefault();
          handleCloseReceiptAndNewSale();
        } else if (e.key === 'p' || e.key === 'P') {
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            if (receiptHtml) printReceiptDirectly(receiptHtml);
          }
        }
        return;
      }

      // 2. If Payment modal is open:
      if (showPayModal) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowPayModal(false);
          barcodeInputRef.current?.focus();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (!submittingBill) handleCheckout();
        } else if (paymentMethod === 'CASH') {
          // Number keys 1-5: quick cash fill
          const grandRupees = paiseToRupees(totals.grandTotal);
          if (e.key === '1') { setCashReceived(totals.grandTotal); }
          else if (e.key === '2') { setCashReceived(rupeesToPaise(Math.ceil(grandRupees / 100) * 100)); }
          else if (e.key === '3') { handleQuickCash(500); }
          else if (e.key === '4') { handleQuickCash(1000); }
          else if (e.key === '5') { handleQuickCash(2000); }
        } else {
          if (e.key === '1') setPaymentMethod('CASH');
          else if (e.key === '2') setPaymentMethod('UPI');
          else if (e.key === '3') setPaymentMethod('CARD');
        }
        return;
      }

      // 3. If Customer or Discount modal is open:
      if (showCustomerModal || showDiscountModal) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowCustomerModal(false);
          setShowDiscountModal(false);
          barcodeInputRef.current?.focus();
        }
        return;
      }

      // 4. Main Billing Terminal Hotkeys (Zero Mouse!):
      // F12 or Ctrl+Enter: 1-Step Quick Cash & Print
      if (e.key === 'F12' || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        if (activeCart.length > 0 && !submittingBill) {
          handleCheckout('CASH', totals.grandTotal);
        } else if (activeCart.length === 0) {
          toast.error('Cart is empty. Scan or search items first.');
        }
        return;
      }

      // F9 or F4: Open Payment Modal (for UPI / Card / custom cash)
      if (e.key === 'F9' || e.key === 'F4') {
        e.preventDefault();
        if (activeCart.length > 0) {
          setCashReceived(totals.grandTotal);
          setShowPayModal(true);
        } else {
          toast.error('Cart is empty');
        }
        return;
      }

      // F8: Clear Cart
      if (e.key === 'F8') {
        e.preventDefault();
        if (activeCart.length > 0) {
          clearCart();
          toast('Cart cleared', { icon: '🗑️' });
        }
        return;
      }

      // F2: Focus Search / Barcode Box
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
        return;
      }

      // F3: Focus Customer Mobile Input
      if (e.key === 'F3') {
        e.preventDefault();
        customerPhoneInputRef.current?.focus();
        customerPhoneInputRef.current?.select();
        return;
      }

      // F5: Refresh products & stock without leaving POS
      if (e.key === 'F5') {
        e.preventDefault();
        toast('Refreshing stock...', { icon: '🔄' });
        refreshProducts(true).then(() => {
          toast.success('Products & stock refreshed!', { icon: '✅' });
        });
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    completedBill,
    receiptHtml,
    showPayModal,
    showCustomerModal,
    showDiscountModal,
    submittingBill,
    activeCart,
    totals,
  ]);

  // Process Bill Checkout (Supports 1-click Quick Cash or Modal checkout)
  const handleCheckout = async (
    forcedMethodParam?: 'CASH' | 'UPI' | 'CARD' | unknown,
    forcedCash?: number
  ) => {
    // Ensure forcedMethod is strictly a string, never a click event object!
    const forcedMethod =
      typeof forcedMethodParam === 'string' && ['CASH', 'UPI', 'CARD'].includes(forcedMethodParam)
        ? (forcedMethodParam as 'CASH' | 'UPI' | 'CARD')
        : undefined;

    if (activeCart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const currentMethod = forcedMethod || paymentMethod;
    const currentCash = forcedMethod === 'CASH' ? (forcedCash ?? totals.grandTotal) : (currentMethod === 'CASH' ? (cashReceived || totals.grandTotal) : totals.grandTotal);

    if (currentMethod === 'CASH' && currentCash > 0 && currentCash < totals.grandTotal) {
      toast.error('Cash received is less than grand total');
      return;
    }

    setSubmittingBill(true);
    try {
      const payload = {
        customerName: activeCustomerName.trim() || 'Walk-in Customer',
        customerPhone: activeCustomerPhone.trim() || undefined,
        customerId: customerId || undefined,
        pointsRedeemed: (customerId && loyaltyConfig?.isEnabled && pointsToRedeem > 0) ? pointsToRedeem : 0,
        paymentMethod: currentMethod,
        cashReceived: Math.round(currentCash),
        discountTotal: Math.round(discountTotal),
        items: activeCart.map((i) => ({
          productId: i.productId,
          productName: i.name,
          barcode: i.barcode,
          unit: i.unit,
          quantity: i.quantity,
          unitPrice: Math.round(i.unitPrice),
          taxRate: Math.round(i.taxRate),
          discount: Math.round(i.discount),
        })),
        razorpayOrderId: dynamicQrOrder ? dynamicQrOrder.orderId : undefined,
      };

      const res = await fetch('/api/v1/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setDynamicQrOrder(null);
        setPollingPayment(false);
        toast.success(`Bill #${json.data.billNumber} Generated!`);
        setShowPayModal(false);

        // Safe address formatting
        const orgAddr = json.data.org?.address;
        const formattedAddress = orgAddr
          ? typeof orgAddr === 'string'
            ? orgAddr
            : [orgAddr.line1, orgAddr.city, orgAddr.state, orgAddr.pincode].filter(Boolean).join(', ')
          : undefined;

        // Generate printable thermal receipt data safely
        const printData = {
          shopName: json.data.org?.name || 'Ameen Supermarket & Department Store',
          shopAddress: formattedAddress,
          shopPhone: json.data.org?.phone || undefined,
          gstin: json.data.org?.gstin || undefined,
          billNumber: json.data.billNumber,
          date: new Date(json.data.createdAt).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
          }),
          cashierName: json.data.user?.name || 'Cashier',
          customerName: json.data.customerName,
          customerPhone: json.data.customerPhone,
          subtotal: paiseToRupees(json.data.subtotal),
          taxTotal: paiseToRupees(json.data.taxTotal),
          discountTotal: paiseToRupees(json.data.discountTotal),
          grandTotal: paiseToRupees(json.data.total),
          paymentMethod: json.data.paymentMethod,
          cashReceived: json.data.cashReceived ? paiseToRupees(json.data.cashReceived) : undefined,
          changeReturned: json.data.changeReturned ? paiseToRupees(json.data.changeReturned) : undefined,
          receiptFooter: json.data.org?.receiptFooter || 'Thank you for shopping with us!\nVisit again.',
          pointsEarned: json.data.pointsEarned || undefined,
          pointsRedeemed: json.data.pointsRedeemed || undefined,
          loyaltyBalance: json.data.customer?.loyaltyPoints !== undefined ? json.data.customer.loyaltyPoints : undefined,
          items: (json.data.items || []).map((it: any) => ({
            name: it.productName,
            barcode: it.barcode,
            quantity: it.quantity,
            unit: it.unit,
            price: paiseToRupees(it.unitPrice),
            total: paiseToRupees(it.lineTotal),
          })),
        };

        // Render live bill preview state first
        let html = '';
        try {
          html = ThermalReceiptEngine.generateHtml(printData, '80mm');
        } catch (genErr) {
          console.warn('HTML receipt generation error:', genErr);
        }

        // Instantly update stock locally for immediate UI feedback
        setProducts((prev) =>
          prev.map((p) => {
            const bought = activeCart.find((c) => c.productId === p.id);
            return bought ? { ...p, stock: Math.max(0, p.stock - bought.quantity) } : p;
          })
        );
        // Also silently refresh from server in background to get accurate counts
        refreshProducts(true);

        clearCart();
        if (showPayModal) setShowPayModal(false);

        if (fastMode) {
          // 🚀 FAST TURBO MODE: 
          // Zero system print dialog, zero screen popups, zero download prompts!
          // Instantly ready for the next customer in queue!
          toast.success(`⚡ Bill ${json.data.billNumber} Saved (₹${paiseToRupees(json.data.total).toFixed(2)})`, {
            duration: 2500,
            icon: '✅',
          });
          setCompletedBill(null);
          setReceiptHtml(null);
          setTimeout(() => {
            barcodeInputRef.current?.focus();
          }, 50);
        } else {
          // Standard Mode: show bill preview and trigger system print dialog
          setCompletedBill(json.data);
          setReceiptHtml(html);
          if (html) {
            printReceiptDirectly(html);
          }
        }
      } else {
        toast.error(json.error ?? 'Failed to process bill');
      }
    } catch (err: any) {
      console.error('Checkout processing error:', err);
      toast.error(err?.message || 'Error processing bill. Please try again.');
    } finally {
      setSubmittingBill(false);
    }
  };

  const handlePrintReceipt = () => {
    if (receiptHtml) {
      printReceiptDirectly(receiptHtml);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-bg-base font-sans">
      {/* -------------------------------------------------------------
          LEFT: PRODUCT CATALOG & SEARCH (POS Grid)
          ------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border-light h-full overflow-hidden">
        {/* Top Search & Barcode Bar */}
        <div className="p-4 border-b border-border-light bg-panel flex items-center gap-3 shrink-0">
          <form onSubmit={handleBarcodeSubmit} className="flex-1 relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              ref={barcodeInputRef}
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Scan Barcode / Enter Product Code or Name (Press Enter to auto-add)..."
              className="w-full bg-stone-50 border border-border-light rounded-xl py-2.5 pl-10 pr-32 text-xs focus:outline-none focus:border-brand/70 focus:ring-2 focus:ring-brand/20 focus:bg-white transition-all font-medium"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {searchQuery && filteredProducts.length > 0 ? (
                <span className="text-[10px] text-brand font-bold bg-brand/10 border border-brand/20 px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                  ↵ Enter: Add Item
                </span>
              ) : activeCart.length > 0 ? (
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100/90 border border-emerald-300/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                  ↵ Enter / F12: {fastMode ? 'Complete & Save' : 'Print Bill'}
                </span>
              ) : null}
              <div className="flex items-center gap-1 text-[10px] font-bold text-stone-400 bg-stone-200/50 px-2 py-0.5 rounded-md">
                <Barcode size={12} /> Scan (F2)
              </div>
            </div>
          </form>

          {/* Quick Clear Filter */}
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setHighlightedIndex(0);
                barcodeInputRef.current?.focus();
              }}
              className="text-stone-400 hover:text-stone-700 text-xs px-2 py-1"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Filter Pills (Matching POS CategoryPanel) */}
        <div className="px-4 py-2.5 border-b border-border-light bg-stone-50/60 overflow-x-auto shrink-0 flex items-center gap-1.5 no-scrollbar">
          <button
            onClick={() => setActiveCategoryId('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeCategoryId === 'all'
                ? 'bg-brand text-white shadow-xs'
                : 'bg-panel text-stone-600 border border-border-light hover:bg-stone-100'
            }`}
          >
            All Items ({products.length})
          </button>

          {categories.map((cat) => {
            const active = activeCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  active
                    ? 'bg-brand text-white shadow-xs'
                    : 'bg-panel text-stone-600 border border-border-light hover:bg-stone-100'
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Products Grid (Matching POS ProductGrid) */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="h-full flex items-center justify-center text-stone-400 text-xs">
              Loading shop products...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-stone-400 p-8 text-center">
              <ShoppingBag size={36} className="text-stone-300 mb-2" />
              <p className="font-semibold text-stone-600 text-sm">No products found</p>
              <p className="text-xs text-stone-400 mt-1">
                Try searching with a different name or barcode
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredProducts.map((p, index) => {
                const isOutOfStock = p.stock <= 0;
                const isLowStock = p.stock > 0 && p.stock <= (p.minStock ?? 5);
                const cartQty = activeCart.find((c) => c.productId === p.id)?.quantity || 0;
                const isAutoSelected = searchQuery.trim().length > 0 && index === highlightedIndex;
                const cartExceedsStock = cartQty > 0 && cartQty >= p.stock;

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (!isOutOfStock) {
                        addToCart(p);
                        barcodeInputRef.current?.focus();
                      }
                    }}
                    className={`bg-panel border rounded-xl p-3.5 flex flex-col justify-between transition-all select-none relative group cursor-pointer ${
                      isAutoSelected
                        ? 'border-brand ring-2 ring-brand shadow-md bg-orange-50/20 scale-[1.01]'
                        : cartQty > 0
                        ? 'border-brand shadow-xs ring-1 ring-brand/30'
                        : 'border-border-light hover:border-brand/40 hover:shadow-xs'
                    } ${isOutOfStock ? 'opacity-50 cursor-not-allowed bg-stone-50' : 'active:scale-98'}`}
                  >
                    {/* Auto-selected indicator badge */}
                    {isAutoSelected && (
                      <span className="absolute -top-2 left-3 bg-brand text-white font-bold text-[9px] px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1 z-10 animate-pulse">
                        ↵ Press Enter
                      </span>
                    )}

                    {/* Active cart quantity badge */}
                    {cartQty > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-brand text-white font-bold text-[10px] flex items-center justify-center shadow-sm">
                        {cartQty}
                      </span>
                    )}

                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="font-bold text-xs text-stone-800 line-clamp-2 leading-snug">
                          {p.name}
                        </span>
                      </div>

                      {p.barcode && (
                        <span className="text-[10px] font-mono text-stone-400 block mb-1">
                          #{p.barcode}
                        </span>
                      )}
                    </div>

                    <div className="pt-2 border-t border-border-light/60 flex items-center justify-between mt-2">
                      <div>
                        <span className="font-display font-extrabold text-sm text-stone-900 block">
                          {formatCurrency(p.price)}
                        </span>
                        <span className="text-[9px] text-stone-400">
                          per {p.unit} {p.taxRate > 0 ? `· GST ${bpsToPercent(p.taxRate)}` : ''}
                        </span>
                      </div>

                      {/* Stock badge */}
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                          isOutOfStock
                            ? 'bg-red-50 text-red-600'
                            : cartExceedsStock
                            ? 'bg-red-50 text-red-600 animate-pulse'
                            : isLowStock
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                        title={isOutOfStock ? 'Out of Stock — cannot add to cart' : cartExceedsStock ? 'Cart qty at stock limit!' : undefined}
                      >
                        {isOutOfStock ? '⚠ Out of Stock' : `${p.stock} ${p.unit}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Compact POS Keyboard Shortcuts Strip */}
        <div className="px-4 py-2 border-t border-border-light bg-stone-100/70 text-[11px] text-stone-500 flex items-center justify-between gap-3 shrink-0 flex-wrap select-none">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-stone-300 rounded font-mono font-bold text-stone-700 text-[10px] shadow-2xs">↵ Enter</kbd>
              <span>{fastMode ? 'Auto-Add / Complete' : 'Auto-Add / Print'}</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-stone-300 rounded font-mono font-bold text-stone-700 text-[10px] shadow-2xs">F12</kbd>
              <span>{fastMode ? 'Quick Cash & Next' : 'Quick Cash & Print'}</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-stone-300 rounded font-mono font-bold text-stone-700 text-[10px] shadow-2xs">F9</kbd>
              <span>UPI / Card</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-stone-300 rounded font-mono font-bold text-stone-700 text-[10px] shadow-2xs">↑ / ↓</kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-stone-300 rounded font-mono font-bold text-stone-700 text-[10px] shadow-2xs">F8</kbd>
              <span>Clear Cart</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-stone-300 rounded font-mono font-bold text-stone-700 text-[10px] shadow-2xs">F2</kbd>
              <span>Items</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-amber-100 border border-amber-300 text-amber-900 rounded font-mono font-bold text-[10px] shadow-2xs">F3</kbd>
              <span className="font-semibold text-amber-900">Customer Mobile</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded font-mono font-bold text-[10px] shadow-2xs">F5</kbd>
              <span className="text-blue-700 font-semibold">Refresh Stock</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {refreshing && (
              <span className="text-[10px] text-blue-600 font-semibold flex items-center gap-1">
                <RefreshCw size={10} className="animate-spin" /> Refreshing...
              </span>
            )}
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              ● 100% Mouse-Free POS
            </span>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          RIGHT: LIVE BILL CART & QUICK CHECKOUT PANEL (CartPanel)
          ------------------------------------------------------------- */}
      <div className="w-96 bg-panel flex flex-col h-full shrink-0 shadow-lg">
        {/* Customer Info & Quick Capture Bar */}
        {mounted && customerId ? (
          /* Linked Customer Card */
          <div className="p-3 border-b border-border-light bg-gradient-to-r from-amber-50/80 to-orange-50/60 transition-all">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                  <User size={15} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span suppressHydrationWarning className="font-bold text-xs text-stone-900 truncate block">
                      {activeCustomerName}
                    </span>
                    {(() => {
                      const tier = getCustomerTier(loyaltyBalance);
                      return tier ? (
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full border ${tier.cls}`}>
                          {tier.emoji} {tier.label}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-stone-500 mt-0.5">
                    {activeCustomerPhone && <span className="font-mono">{activeCustomerPhone}</span>}
                    <span className="text-amber-800 font-extrabold">★ {loyaltyBalance.toLocaleString()} pts</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(true)}
                  className="px-2 py-1 text-stone-500 hover:text-stone-800 hover:bg-white/80 border border-stone-200/60 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                  title="Change or edit customer details"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={handleResetToWalkIn}
                  className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg text-[10px] cursor-pointer transition-colors"
                  title="Reset to Walk-in customer"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Walk-in Mode: Inline Quick Mobile Input */
          <div className="p-3 border-b border-border-light bg-stone-50/90 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                <Phone size={11} className="text-amber-600" /> Customer Mobile (F3)
              </span>
              <button
                type="button"
                onClick={() => setShowCustomerModal(true)}
                className="text-[10px] text-brand hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
              >
                <span>Directory</span>
              </button>
            </div>

            {!showQuickNewCustomer ? (
              <div className="relative flex items-center">
                <Phone size={13} className="absolute left-2.5 text-stone-400 pointer-events-none" />
                <input
                  ref={customerPhoneInputRef}
                  type="tel"
                  value={quickPhoneInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setQuickPhoneInput(val);
                    const clean = val.replace(/\D/g, '');
                    if (clean.length === 10) {
                      handleQuickCustomerLookup(val);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (quickPhoneInput.trim()) {
                        handleQuickCustomerLookup(quickPhoneInput);
                      }
                    } else if (e.key === 'Escape') {
                      barcodeInputRef.current?.focus();
                    }
                  }}
                  placeholder="Mobile no. (press Enter)..."
                  className="w-full bg-white border border-border-light rounded-xl pl-8 pr-16 py-1.5 text-xs font-mono focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all shadow-2xs"
                />
                <div className="absolute right-1.5 flex items-center gap-1">
                  {quickSearching ? (
                    <span className="w-3.5 h-3.5 border-2 border-amber-500/30 border-t-amber-600 rounded-full animate-spin mr-1" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleQuickCustomerLookup(quickPhoneInput)}
                      disabled={!quickPhoneInput.trim()}
                      className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-30 text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-0.5"
                      title="Search or Add customer"
                    >
                      <span>Find</span>
                      <ArrowRight size={10} />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* New Customer Prompt */
              <form onSubmit={handleCreateAndLinkQuickCustomer} className="space-y-1.5 pt-0.5 animate-in fade-in">
                <div className="flex items-center justify-between text-[10px] text-amber-800 font-bold bg-amber-100/70 px-2 py-0.5 rounded-md">
                  <span>New Customer ({quickPhoneInput})</span>
                  <button
                    type="button"
                    onClick={() => setShowQuickNewCustomer(false)}
                    className="text-stone-400 hover:text-stone-700"
                  >
                    <X size={11} />
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <input
                    ref={newCustomerNameInputRef}
                    type="text"
                    value={quickNameInput}
                    onChange={(e) => setQuickNameInput(e.target.value)}
                    placeholder="Enter Customer Name..."
                    className="flex-1 bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-lg cursor-pointer flex items-center gap-1 shrink-0 shadow-2xs"
                  >
                    <UserPlus size={12} />
                    <span>Link</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Order Info & Controls Sub-Header */}
        <div className="px-3.5 py-2 border-b border-border-light bg-stone-100/60 flex items-center justify-between">
          <span className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
            <ShoppingBag size={13} className="text-brand" />
            <span suppressHydrationWarning>Current Bill ({activeCart.length} items)</span>
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* ⚡ Fast Mode Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !fastMode;
                setFastMode(next);
                try { localStorage.setItem('pos_fast_mode', String(next)); } catch (_) {}
                toast(next ? 'Fast Mode ON: Auto-save bill without popup' : 'Print Mode ON: System print dialog enabled', { icon: next ? '⚡' : '🖨️' });
              }}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                fastMode
                  ? 'bg-amber-100 text-amber-800 border-amber-300 shadow-2xs'
                  : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-100'
              }`}
              title={fastMode ? 'Fast Mode ON: Instant bill saving without system print dialog' : 'Print Mode ON: Opens system print dialog'}
            >
              <Zap size={10} className={fastMode ? 'text-amber-600 fill-amber-500' : 'text-stone-400'} />
              <span>{fastMode ? 'Fast Mode' : 'Print Mode'}</span>
            </button>

            <button
              onClick={clearCart}
              disabled={activeCart.length === 0}
              className="text-stone-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50 transition-colors disabled:opacity-20 cursor-pointer"
              title="Clear Cart (F8)"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
          {activeCart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-stone-300 text-center p-6 space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-stone-50 flex items-center justify-center border border-border-light text-stone-300">
                <ShoppingBag size={24} />
              </div>
              <p className="font-semibold text-stone-600 text-xs">Cart is empty</p>
              <p className="text-[11px] text-stone-400 leading-relaxed">
                Click products or scan barcode to add items to bill
              </p>
            </div>
          ) : (
            // Show newest items at top of cart for faster review
            [...activeCart].reverse().map((item) => {
              const lineTotal = item.quantity * item.unitPrice;
              const prodInList = products.find((p) => p.id === item.productId);
              const stockExceeded = prodInList && item.quantity > prodInList.stock;
              const isEditing = inlineEditId === item.id;

              return (
                <div
                  key={item.id}
                  className={`bg-white border rounded-xl p-2.5 shadow-2xs space-y-2 transition-colors ${
                    stockExceeded ? 'border-red-300 bg-red-50/30' : 'border-border-light hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-xs text-stone-800 truncate block">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        {formatCurrency(item.unitPrice)} / {item.unit}
                      </span>
                      {stockExceeded && (
                        <span className="text-[10px] text-red-600 font-bold flex items-center gap-0.5 mt-0.5">
                          ⚠ Only {prodInList!.stock} {item.unit} in stock
                        </span>
                      )}
                    </div>

                    <span className="font-display font-extrabold text-xs text-stone-900 shrink-0">
                      {formatCurrency(lineTotal)}
                    </span>
                  </div>

                  {/* Quantity controls with inline edit */}
                  <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                    <div className="flex items-center gap-1.5 bg-stone-100 p-0.5 rounded-lg">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-6 h-6 rounded-md bg-white border border-border-light flex items-center justify-center text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer"
                      >
                        <Minus size={11} />
                      </button>

                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          autoFocus
                          value={inlineEditVal}
                          onChange={(e) => setInlineEditVal(e.target.value)}
                          onBlur={() => {
                            const v = parseFloat(inlineEditVal);
                            if (!isNaN(v) && v > 0) updateQuantity(item.id, v);
                            setInlineEditId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const v = parseFloat(inlineEditVal);
                              if (!isNaN(v) && v > 0) updateQuantity(item.id, v);
                              setInlineEditId(null);
                              setTimeout(() => barcodeInputRef.current?.focus(), 50);
                            } else if (e.key === 'Escape') {
                              setInlineEditId(null);
                            }
                          }}
                          className="w-14 text-center font-bold text-xs text-stone-800 bg-white border border-brand rounded-md px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand/30"
                        />
                      ) : (
                        <button
                          onClick={() => { setInlineEditId(item.id); setInlineEditVal(String(item.quantity)); }}
                          className="w-9 text-center font-bold text-xs text-stone-800 hover:text-brand hover:bg-white/80 rounded-md py-0.5 transition-colors cursor-pointer"
                          title="Click to type exact quantity"
                        >
                          {item.quantity}
                        </button>
                      )}

                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-6 h-6 rounded-md bg-white border border-border-light flex items-center justify-center text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer"
                      >
                        <Plus size={11} />
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-stone-300 hover:text-red-500 p-1 transition-colors cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Totals & Action Checkout Bar (Matching POS OrderSummary) */}
        <div className="border-t border-border-light p-4 bg-stone-50/50 space-y-3 shrink-0">
          {/* Summary Breakdown */}
          <div suppressHydrationWarning className="space-y-1.5 text-xs text-stone-600 font-medium">
            <div className="flex justify-between">
              <span suppressHydrationWarning>Items Subtotal ({totals.itemCount} units):</span>
              <span suppressHydrationWarning className="font-bold text-stone-800">{formatCurrency(totals.subtotal)}</span>
            </div>

            {totals.discountTotal > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount:</span>
                <span suppressHydrationWarning className="font-bold">-{formatCurrency(totals.discountTotal)}</span>
              </div>
            )}

            {totals.taxTotal > 0 && (
              <div className="flex justify-between text-stone-500">
                <span>GST Tax Collected:</span>
                <span suppressHydrationWarning className="font-bold text-stone-700">{formatCurrency(totals.taxTotal)}</span>
              </div>
            )}

            {/* Loyalty Redemption Row */}
            {mounted && customerId && loyaltyConfig?.isEnabled && loyaltyBalance >= (loyaltyConfig.minPointsRedeem ?? 50) && (
              <div className="pt-1.5 pb-1 border-t border-amber-100">
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className="flex items-center gap-1.5 font-semibold text-amber-700">
                    <Gift size={11} />
                    Loyalty Points ({loyaltyBalance.toLocaleString()} available)
                  </span>
                  <button
                    type="button"
                    onClick={() => setPointsToRedeem(pointsToRedeem > 0 ? 0 : Math.min(loyaltyBalance, Math.floor(totals.grandTotal / loyaltyConfig.pointValuePaise)))}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all cursor-pointer ${pointsToRedeem > 0 ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-600 border-amber-300 hover:bg-amber-50'}`}
                  >
                    {pointsToRedeem > 0 ? `Redeeming ${pointsToRedeem} pts` : 'Use Points'}
                  </button>
                </div>
                {pointsToRedeem > 0 && (
                  <div className="flex justify-between text-amber-700 font-bold text-xs">
                    <span>Points Discount ({pointsToRedeem} × ₹{(loyaltyConfig.pointValuePaise / 100).toFixed(2)}):</span>
                    <span suppressHydrationWarning>-{formatCurrency(pointsToRedeem * loyaltyConfig.pointValuePaise)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between items-baseline pt-2 border-t border-border-light">
              <span className="font-bold text-xs text-stone-700 uppercase tracking-wide">
                Grand Total:
              </span>
              <span suppressHydrationWarning className="font-display font-extrabold text-2xl text-brand tracking-tight">
                {formatCurrency(Math.max(0, totals.grandTotal - (pointsToRedeem > 0 && loyaltyConfig ? pointsToRedeem * loyaltyConfig.pointValuePaise : 0)))}
              </span>
            </div>
          </div>

          {/* Quick Actions: 1-Click Cash & Standard Checkout */}
          <div className="space-y-2 pt-1">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDiscountModal(true)}
                disabled={activeCart.length === 0}
                className="py-2.5 px-3 bg-white border border-border-light hover:bg-stone-100 disabled:opacity-40 rounded-xl text-xs font-bold text-stone-700 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                title="Apply percentage or flat discount"
              >
                <Percent size={13} /> Discount
              </button>

              {/* ⚡ 1-Click Quick Cash & Complete: Zero extra steps */}
              <button
                type="button"
                onClick={() => handleCheckout('CASH', totals.grandTotal)}
                disabled={activeCart.length === 0 || submittingBill}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all active:scale-98"
                title={fastMode ? '1-Click: Save bill immediately & ready for next customer' : '1-Click: Complete sale and open system print dialog'}
              >
                <Zap size={14} className="fill-current text-emerald-200" />
                {submittingBill ? 'Processing...' : fastMode ? 'Quick Cash & Next' : 'Quick Cash & Print'}
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 bg-emerald-800/60 rounded text-[10px] font-mono ml-1 text-emerald-100">
                  F12 / ↵
                </kbd>
              </button>
            </div>

            {/* Standard Checkout: Opens UPI/Card/Custom Cash options */}
            <button
              type="button"
              onClick={() => {
                setCashReceived(totals.grandTotal);
                setShowPayModal(true);
              }}
              disabled={activeCart.length === 0 || submittingBill}
              className="w-full py-2.5 bg-brand hover:bg-brand-dark disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-98"
            >
              <CreditCard size={15} /> Checkout &amp; Pay (UPI / Card / Cash)
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 bg-black/20 rounded text-[10px] font-mono text-white/90">
                F9
              </kbd>
            </button>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          MODAL: PAYMENT & THERMAL CHECKOUT
          ------------------------------------------------------------- */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-panel border border-border-light rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border-light pb-3">
              <div>
                <h3 className="font-display font-bold text-lg text-stone-800">
                  Process Payment
                </h3>
                <p className="text-xs text-stone-500 font-medium">
                  Select payment method and issue bill
                </p>
              </div>
              <button
                onClick={() => setShowPayModal(false)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Total Display */}
            <div className="bg-stone-50 border border-border-light rounded-xl p-4 text-center">
              <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block mb-1">
                Amount Payable
              </span>
              <span className="font-display font-extrabold text-3xl text-brand tracking-tight">
                {formatCurrency(totals.grandTotal)}
              </span>
            </div>

            {/* Customer linked info in Pay Modal */}
            <div className="bg-stone-50/80 border border-border-light rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                  <User size={13} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-xs text-stone-800 truncate">{activeCustomerName}</span>
                    {customerId && (() => {
                      const tier = getCustomerTier(loyaltyBalance);
                      return tier ? (
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full border ${tier.cls}`}>
                          {tier.emoji} {tier.label}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <div className="text-[10px] text-stone-400 font-mono">
                    {activeCustomerPhone || 'No phone linked (Walk-in)'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomerModal(true)}
                className="text-xs text-brand hover:underline font-bold px-2 py-1 cursor-pointer shrink-0"
              >
                {customerId ? 'Change' : '+ Add Phone'}
              </button>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-3 gap-2">
              {(['CASH', 'UPI', 'CARD'] as const).map((method) => {
                const active = paymentMethod === method;
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      active
                        ? 'bg-brand text-white border-brand shadow-xs'
                        : 'bg-panel border-border-light text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    {method === 'CASH' && <Banknote size={16} />}
                    {method === 'UPI' && <QrCode size={16} />}
                    {method === 'CARD' && <CreditCard size={16} />}
                    <span>{method}</span>
                  </button>
                );
              })}
            </div>

            {/* Cash Calculations */}
            {paymentMethod === 'CASH' && (
              <div className="space-y-3 bg-stone-50/70 p-3.5 rounded-xl border border-border-light">
                <div className="flex justify-between items-center text-xs font-semibold text-stone-700">
                  <span>Cash Tendered (₹):</span>
                  <input
                    type="number"
                    step="1"
                    value={cashReceived > 0 ? paiseToRupees(cashReceived) : ''}
                    onChange={(e) => setCashReceived(rupeesToPaise(parseFloat(e.target.value) || 0))}
                    placeholder={String(paiseToRupees(totals.grandTotal))}
                    className="w-32 bg-white border border-border-light rounded-lg px-2.5 py-1.5 text-right font-bold text-sm focus:outline-none focus:border-brand"
                  />
                </div>

                {/* Quick denomination pills — press 1/2/3/4/5 on keyboard */}
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  <span className="text-[10px] text-stone-400 font-bold uppercase">Quick:</span>
                  {[
                    { label: `Exact ₹${paiseToRupees(totals.grandTotal).toFixed(0)}`, val: paiseToRupees(totals.grandTotal), key: '1' },
                    { label: `₹${Math.ceil(paiseToRupees(totals.grandTotal) / 100) * 100}`, val: Math.ceil(paiseToRupees(totals.grandTotal) / 100) * 100, key: '2' },
                    { label: '₹500', val: 500, key: '3' },
                    { label: '₹1000', val: 1000, key: '4' },
                    { label: '₹2000', val: 2000, key: '5' },
                  ].map(({ label, val, key }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleQuickCash(val)}
                      className="bg-white border border-border-light hover:bg-stone-100 text-stone-700 text-[10px] font-bold px-2 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <kbd className="text-[9px] bg-stone-100 border border-stone-300 rounded px-0.5 text-stone-500 font-mono">{key}</kbd>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Change return output */}
                <div className="flex justify-between items-center pt-2 border-t border-border-light text-xs font-bold">
                  <span className="text-stone-600">Change to Return:</span>
                  <span
                    className={`font-display text-sm ${
                      totals.changeReturned > 0 ? 'text-emerald-700 font-extrabold' : 'text-stone-400'
                    }`}
                  >
                    {formatCurrency(totals.changeReturned)}
                  </span>
                </div>
              </div>
            )}

            {paymentMethod === 'UPI' && (
              <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-3">
                {dynamicQrOrder ? (
                  <div className="text-center space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1">
                        <QrCode size={14} className="text-emerald-700" />
                        Razorpay Dynamic UPI QR
                      </span>
                      {dynamicQrOrder.isTestMode ? (
                        <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md">
                          Simulator / Test Mode
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-md">
                          Live Razorpay POS
                        </span>
                      )}
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-emerald-200 shadow-sm inline-block mx-auto">
                      <img
                        src={dynamicQrOrder.qrCodeDataUrl}
                        alt="Dynamic UPI QR Code"
                        className="w-44 h-44 mx-auto rounded-lg"
                      />
                    </div>

                    <div className="space-y-1 text-center">
                      <div className="font-extrabold text-stone-900 text-sm">
                        Pay {formatCurrency(totals.grandTotal)}
                      </div>
                      <div className="text-[10px] text-stone-500 font-mono">
                        Order ID: {dynamicQrOrder.orderId}
                      </div>
                      <div className="flex items-center justify-center gap-1.5 text-emerald-700 text-xs font-semibold pt-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        <span>Listening for customer UPI payment...</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleCheckout('UPI', totals.grandTotal)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                      >
                        <CheckCircle size={13} />
                        <span>Confirm Received</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerateRazorpayQr}
                        disabled={generatingQr}
                        className="bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 font-semibold text-xs py-2 px-3 rounded-lg transition-colors cursor-pointer"
                      >
                        Refresh QR
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-2.5 py-1">
                    <QrCode size={36} className="mx-auto text-emerald-700" />
                    <div>
                      <span className="font-bold text-xs text-emerald-950 block">
                        Razorpay Dynamic UPI QR
                      </span>
                      <span className="text-[11px] text-emerald-700">
                        Generate unique QR code for exact amount {formatCurrency(totals.grandTotal)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateRazorpayQr}
                      disabled={generatingQr}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-60"
                    >
                      {generatingQr ? (
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <QrCode size={14} />
                      )}
                      <span>Generate Dynamic UPI QR</span>
                    </button>
                    <p className="text-[10px] text-stone-400">
                      Or customer can pay via general store QR and you can proceed with checkout.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Confirm Submit */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => handleCheckout()}
                disabled={submittingBill}
                className="flex-1 bg-brand hover:bg-brand-dark text-white font-bold text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-60"
              >
                {submittingBill ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircle size={15} />
                )}
                <span>{fastMode ? 'Complete Sale & Next Customer' : 'Complete Sale & Print Bill'}</span>
                <kbd className="px-1.5 py-0.5 bg-brand-dark/50 border border-white/20 rounded text-[10px] font-mono text-white/90">
                  ↵ Enter
                </kbd>
              </button>
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="border border-border-light text-stone-600 hover:bg-stone-50 text-xs font-semibold px-4 py-3 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Cancel</span>
                <kbd className="px-1 py-0.5 bg-stone-200/70 border border-stone-300 rounded text-[9px] font-mono text-stone-600">
                  Esc
                </kbd>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL: CUSTOMER SELECTOR
          ------------------------------------------------------------- */}
      {showCustomerModal && (
        <CustomerSelectorModal
          initialName={customerName}
          initialPhone={customerPhone}
          onSelect={(name, phone, id, loyaltyPts) => {
            setCustomer(name, phone, id, loyaltyPts);
            setShowCustomerModal(false);
          }}
          onClose={() => setShowCustomerModal(false)}
        />
      )}

      {/* -------------------------------------------------------------
          MODAL: DISCOUNT APPLY
          ------------------------------------------------------------- */}
      {showDiscountModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-panel border border-border-light rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-border-light pb-3">
              <h3 className="font-bold text-sm text-stone-800">Apply Discount</h3>
              <button onClick={() => setShowDiscountModal(false)} className="text-stone-400">
                <X size={15} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      const discPaise = Math.round((totals.subtotal * pct) / 100);
                      setDiscountTotal(discPaise);
                      setShowDiscountModal(false);
                      toast.success(`${pct}% discount applied`);
                    }}
                    className="py-2 rounded-lg border border-border-light bg-stone-50 hover:bg-brand hover:text-white hover:border-brand font-bold transition-all text-stone-700"
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-border-light">
                <label className="block text-stone-600 font-semibold mb-1">
                  Or Flat Discount (₹)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={discountTotal > 0 ? paiseToRupees(discountTotal) : ''}
                    onChange={(e) => setDiscountTotal(rupeesToPaise(parseFloat(e.target.value) || 0))}
                    placeholder="0.00"
                    className="flex-1 border border-border-light rounded-lg p-2 focus:outline-none focus:border-brand bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountTotal(0);
                      setShowDiscountModal(false);
                    }}
                    className="border border-border-light text-stone-500 px-3 rounded-lg text-xs hover:bg-stone-50"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDiscountModal(false)}
                className="w-full bg-brand text-white font-bold py-2 rounded-xl mt-2"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          RECEIPT PRINT POPUP (Immediately after Bill Checkout)
      {/* -------------------------------------------------------------
          INSTANT THERMAL BILL PREVIEW MODAL (Zero extra clicks to view bill!)
          ------------------------------------------------------------- */}
      {completedBill && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-panel border border-border-light rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Top Status & Fast Action Bar */}
            <div className="p-4 bg-stone-900 text-white flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                  <CheckCircle size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-display font-bold text-sm text-white">Bill Completed</span>
                    <span className="bg-brand text-white text-[10px] font-mono px-1.5 py-0.5 rounded font-bold">
                      {completedBill.billNumber}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-400 truncate">
                    Print sent automatically · Press <kbd className="px-1 py-0.5 bg-stone-800 border border-stone-700 rounded text-[9px] text-stone-300 font-mono">Enter</kbd> for next sale
                  </p>
                </div>
              </div>

              <button
                onClick={handleCloseReceiptAndNewSale}
                className="text-stone-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                title="Close (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Action Strip */}
            <div className="bg-stone-800/95 border-b border-stone-700/60 px-4 py-2 flex items-center justify-between gap-2 shrink-0 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => receiptHtml && printReceiptDirectly(receiptHtml)}
                  className="bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Browser System Print Dialog"
                >
                  <Printer size={13} /> Print (System)
                </button>

                <button
                  onClick={() => handleDirectEscPosPrint(completedBill.id)}
                  disabled={printingEscPos}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 shadow-xs"
                  title="Send raw ESC/POS commands directly to LAN/Wi-Fi thermal printer (Port 9100)"
                >
                  {printingEscPos ? (
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Printer size={13} />
                  )}
                  <span>Direct ESC/POS</span>
                </button>

                <button
                  onClick={() => handleSendWhatsAppReceipt(completedBill.id, completedBill.customerPhone)}
                  disabled={sendingWhatsApp}
                  className="bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 shadow-xs"
                  title="Send digital receipt via WhatsApp"
                >
                  {sendingWhatsApp ? (
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>💬</span>
                  )}
                  <span>WhatsApp Bill</span>
                </button>
              </div>

              <button
                onClick={handleCloseReceiptAndNewSale}
                className="bg-brand hover:bg-brand-dark text-white text-xs font-bold py-1.5 px-3.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer ml-auto"
                title="Close and focus barcode scanner for next customer"
              >
                <Plus size={13} /> Next Sale <span className="text-[10px] opacity-75 font-normal">(Enter)</span>
              </button>
            </div>

            {/* Live Bill Preview: Authentic Thermal Paper Receipt */}
            <div className="flex-1 overflow-y-auto p-4 bg-stone-200/70 flex justify-center">
              <div
                className="w-full max-w-[340px] bg-white border border-stone-300 rounded-sm p-4 shadow-md font-mono text-[11px] text-stone-900 leading-tight select-text"
                style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.06))' }}
              >
                {/* Shop Header */}
                <div className="text-center space-y-0.5 pb-2">
                  <div className="font-bold text-xs tracking-wider uppercase font-sans text-stone-900">
                    {completedBill.org?.name || 'Ameen Supermarket & Department Store'}
                  </div>
                  {completedBill.org?.address?.line1 && (
                    <div className="text-[10px] text-stone-600">
                      {completedBill.org.address.line1}, {completedBill.org.address.city || ''}
                    </div>
                  )}
                  {completedBill.org?.phone && (
                    <div className="text-[10px] text-stone-600">Tel: {completedBill.org.phone}</div>
                  )}
                  {completedBill.org?.gstin && (
                    <div className="text-[10px] font-bold text-stone-800">
                      GSTIN: {completedBill.org.gstin}
                    </div>
                  )}
                </div>

                {/* Dashed Line */}
                <div className="border-t border-dashed border-stone-400 my-2" />

                {/* Bill Meta */}
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span>BILL: <strong className="text-stone-900 font-bold">{completedBill.billNumber}</strong></span>
                    <span>{new Date(completedBill.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cashier: {completedBill.user?.name || 'Cashier'}</span>
                    <span>Pay: <strong className="font-bold">{completedBill.paymentMethod}</strong></span>
                  </div>
                  {completedBill.customerName && (
                    <div className="text-stone-700 truncate">
                      Customer: {completedBill.customerName} {completedBill.customerPhone ? `(${completedBill.customerPhone})` : ''}
                    </div>
                  )}
                </div>

                {/* Dashed Line */}
                <div className="border-t border-dashed border-stone-400 my-2" />

                {/* Items Table */}
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className="border-b border-dashed border-stone-400">
                      <th className="py-1 font-bold">ITEM</th>
                      <th className="py-1 text-center font-bold">QTY</th>
                      <th className="py-1 text-right font-bold">RATE</th>
                      <th className="py-1 text-right font-bold">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dashed divide-stone-200">
                    {completedBill.items?.map((it: any, idx: number) => (
                      <tr key={it.id || idx}>
                        <td className="py-1 pr-1 font-medium leading-snug">
                          {it.productName}
                        </td>
                        <td className="py-1 text-center whitespace-nowrap text-stone-600">
                          {it.quantity} {it.unit || 'pcs'}
                        </td>
                        <td className="py-1 text-right whitespace-nowrap text-stone-600">
                          ₹{paiseToRupees(it.unitPrice).toFixed(2)}
                        </td>
                        <td className="py-1 text-right whitespace-nowrap font-bold">
                          ₹{paiseToRupees(it.lineTotal).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Dashed Line */}
                <div className="border-t border-dashed border-stone-400 my-2" />

                {/* Financial Breakdown */}
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>₹{paiseToRupees(completedBill.subtotal).toFixed(2)}</span>
                  </div>
                  {completedBill.discountTotal > 0 && (
                    <div className="flex justify-between text-stone-700">
                      <span>Discount:</span>
                      <span>-₹{paiseToRupees(completedBill.discountTotal).toFixed(2)}</span>
                    </div>
                  )}
                  {completedBill.taxTotal > 0 && (
                    <div className="flex justify-between text-stone-700">
                      <span>GST / Taxes:</span>
                      <span>₹{paiseToRupees(completedBill.taxTotal).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Double divider */}
                <div className="border-t-2 border-stone-900 my-2" />

                {/* Grand Total */}
                <div className="flex justify-between items-center text-xs font-bold py-0.5">
                  <span className="tracking-wide uppercase">GRAND TOTAL:</span>
                  <span className="text-sm font-extrabold">₹{paiseToRupees(completedBill.total).toFixed(2)}</span>
                </div>

                <div className="border-t border-dashed border-stone-400 my-2" />

                {/* Tender / Change */}
                {completedBill.paymentMethod === 'CASH' && (
                  <div className="space-y-1 text-[10px] text-stone-700">
                    <div className="flex justify-between">
                      <span>Cash Received:</span>
                      <span>₹{paiseToRupees(completedBill.cashReceived || completedBill.total).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-stone-900">
                      <span>Change Returned:</span>
                      <span>₹{paiseToRupees(completedBill.changeReturned || 0).toFixed(2)}</span>
                    </div>
                    <div className="border-t border-dashed border-stone-300 my-1.5" />
                  </div>
                )}

                {/* Loyalty Earned on Receipt Preview */}
                {(completedBill.pointsEarned > 0 || completedBill.pointsRedeemed > 0) && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-2 text-center my-2 space-y-0.5 text-[10px]">
                    {completedBill.pointsEarned > 0 && (
                      <div className="font-bold text-amber-900">
                        ★ Earned +{completedBill.pointsEarned} Loyalty Points! ★
                      </div>
                    )}
                    {completedBill.pointsRedeemed > 0 && (
                      <div className="text-amber-800">
                        Redeemed: -{completedBill.pointsRedeemed} pts
                      </div>
                    )}
                    {completedBill.customer?.loyaltyPoints !== undefined && (
                      <div className="text-stone-600 font-semibold text-[9px]">
                        Total Loyalty Balance: {completedBill.customer.loyaltyPoints} pts
                      </div>
                    )}
                  </div>
                )}

                {/* Barcode graphic simulation */}
                <div className="text-center pt-2 pb-1">
                  <div className="inline-flex items-center justify-center gap-0.5 h-6 px-3 bg-stone-100 rounded border border-stone-200">
                    {[2, 1, 3, 1, 2, 4, 1, 3, 1, 2, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2].map((w, i) => (
                      <span
                        key={i}
                        className="bg-stone-900 h-4 inline-block"
                        style={{ width: `${w}px` }}
                      />
                    ))}
                  </div>
                  <div className="text-[9px] text-stone-500 font-mono tracking-widest mt-1">
                    *{completedBill.billNumber}*
                  </div>
                </div>

                {/* Footer Note */}
                <div className="text-center text-[9px] text-stone-500 whitespace-pre-line pt-2 border-t border-dashed border-stone-300">
                  {completedBill.org?.receiptFooter || 'Thank you for shopping with us!\nPlease visit again.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Customer Selector Modal with Loyalty Integration
// ─────────────────────────────────────────────────────────────
interface CustomerSearchResult {
  id: string;
  name: string;
  phone?: string;
  loyaltyPoints: number;
}

function CustomerSelectorModal({
  initialName,
  initialPhone,
  onSelect,
  onClose,
}: {
  initialName: string;
  initialPhone: string;
  onSelect: (name: string, phone: string, id: string | null, loyaltyPts: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [nameInput, setNameInput] = useState(initialName === 'Walk-in Customer' ? '' : initialName);
  const [phoneInput, setPhoneInput] = useState(initialPhone);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length < 1) { setResults([]); return; }
      setSearching(true);
      try {
        const res = await fetch(`/api/v1/customers?search=${encodeURIComponent(query)}&pageSize=8`);
        const json = await res.json();
        if (json.success) setResults(json.data ?? []);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const tierLabel = (pts: number) => {
    if (pts >= 5000) return '💎 Platinum';
    if (pts >= 2000) return '🥇 Gold';
    if (pts >= 500)  return '🥈 Silver';
    if (pts > 0)     return '🥉 Bronze';
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-panel border border-border-light rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
        <div className="flex justify-between items-center border-b border-border-light pb-3">
          <h3 className="font-bold text-sm text-stone-800 flex items-center gap-2">
            <Gift size={14} className="text-amber-500" /> Customer & Loyalty
          </h3>
          <button onClick={onClose} className="text-stone-400 cursor-pointer"><X size={15} /></button>
        </div>

        {/* Search existing customers */}
        <div>
          <label className="block text-[11px] font-semibold text-stone-500 mb-1.5 uppercase tracking-wide">Search Loyalty Member</label>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or phone..."
              className="w-full border border-border-light rounded-xl pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-amber-400 bg-white"
              autoFocus
            />
          </div>

          {(results.length > 0 || searching) && (
            <div className="mt-1.5 border border-border-light rounded-xl overflow-hidden shadow-sm">
              {searching && <div className="p-3 text-center text-xs text-stone-400">Searching...</div>}
              {results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect(c.name, c.phone ?? '', c.id, c.loyaltyPoints)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-amber-50 border-b border-border-light last:border-b-0 transition-colors cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-bold text-stone-800">{c.name}</div>
                    {c.phone && <div className="text-[10px] text-stone-400 font-mono">{c.phone}</div>}
                  </div>
                  {c.loyaltyPoints > 0 ? (
                    <div className="text-right shrink-0 ml-3">
                      <div className="text-xs font-extrabold text-amber-700">{c.loyaltyPoints.toLocaleString()} pts</div>
                      {tierLabel(c.loyaltyPoints) && (
                        <div className="text-[9px] text-amber-600">{tierLabel(c.loyaltyPoints)}</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[10px] text-stone-300">No points</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-dashed border-stone-200 pt-3">
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-2">Or enter walk-in customer</p>
          <div className="space-y-2 text-xs">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Customer name"
              className="w-full border border-border-light rounded-lg px-3 py-2 focus:outline-none focus:border-brand bg-white"
            />
            <input
              type="text"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="Phone (optional)"
              className="w-full border border-border-light rounded-lg px-3 py-2 focus:outline-none focus:border-brand bg-white"
            />
            <button
              type="button"
              onClick={() => onSelect(nameInput.trim() || 'Walk-in Customer', phoneInput.trim(), null, 0)}
              className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              Save as Walk-in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
