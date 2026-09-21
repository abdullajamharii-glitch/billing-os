import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: string; // unique cart item id
  productId: string;
  name: string;
  barcode?: string;
  unit: string;
  quantity: number;
  unitPrice: number; // in paise
  costPrice: number; // in paise
  taxRate: number; // in bps e.g. 500 = 5%
  discount: number; // in paise
}

interface ShopPOSState {
  cart: CartItem[];
  customerName: string;
  customerPhone: string;
  customerId: string | null;       // loyalty customer DB id
  loyaltyBalance: number;          // current points balance (live from API)
  pointsToRedeem: number;          // points the cashier wants to redeem this sale
  discountTotal: number; // in paise
  paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'SPLIT';
  cashReceived: number; // in paise

  // Actions
  addToCart: (product: {
    id: string;
    name: string;
    barcode?: string | null;
    unit?: string;
    price: number;
    costPrice?: number;
    taxRate?: number;
  }) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  setCustomer: (name: string, phone?: string, id?: string | null, loyaltyBalance?: number) => void;
  setPointsToRedeem: (pts: number) => void;
  setDiscountTotal: (discountPaise: number) => void;
  setPaymentMethod: (method: 'CASH' | 'UPI' | 'CARD' | 'SPLIT') => void;
  setCashReceived: (amountPaise: number) => void;

  // Computations
  getTotals: () => {
    itemCount: number;
    subtotal: number;
    taxTotal: number;
    discountTotal: number;
    loyaltyDiscountPaise: number;
    grandTotal: number;
    changeReturned: number;
  };
}

export const useShopPOSStore = create<ShopPOSState>()(
  persist(
    (set, get) => ({
      cart: [],
      customerName: 'Walk-in Customer',
      customerPhone: '',
      customerId: null,
      loyaltyBalance: 0,
      pointsToRedeem: 0,
      discountTotal: 0,
      paymentMethod: 'CASH',
      cashReceived: 0,

      addToCart: (product) => {
        const current = get().cart;
        const existing = current.find((item) => item.productId === product.id);

        if (existing) {
          set({
            cart: current.map((item) =>
              item.productId === product.id
                ? { ...item, quantity: item.quantity + 1 }
                : item
            ),
          });
        } else {
          set({
            cart: [
              ...current,
              {
                id: `cart-${product.id}-${Date.now()}`,
                productId: product.id,
                name: product.name,
                barcode: product.barcode || undefined,
                unit: product.unit || 'pcs',
                quantity: 1,
                unitPrice: product.price,
                costPrice: product.costPrice || 0,
                taxRate: product.taxRate || 0,
                discount: 0,
              },
            ],
          });
        }
      },

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeFromCart(id);
          return;
        }
        set({
          cart: get().cart.map((item) =>
            item.id === id ? { ...item, quantity } : item
          ),
        });
      },

      removeFromCart: (id) => {
        set({ cart: get().cart.filter((item) => item.id !== id) });
      },

      clearCart: () => {
        set({
          cart: [],
          discountTotal: 0,
          cashReceived: 0,
          customerName: 'Walk-in Customer',
          customerPhone: '',
          customerId: null,
          loyaltyBalance: 0,
          pointsToRedeem: 0,
        });
      },

      setCustomer: (name, phone = '', id = null, loyaltyBalance = 0) => {
        set({ customerName: name, customerPhone: phone, customerId: id, loyaltyBalance, pointsToRedeem: 0 });
      },

      setPointsToRedeem: (pts) => {
        const balance = get().loyaltyBalance;
        set({ pointsToRedeem: Math.max(0, Math.min(pts, balance)) });
      },

      setDiscountTotal: (discountPaise) => {
        set({ discountTotal: Math.max(0, discountPaise) });
      },

      setPaymentMethod: (method) => {
        set({ paymentMethod: method });
      },

      setCashReceived: (amountPaise) => {
        set({ cashReceived: amountPaise });
      },

      getTotals: () => {
        const { cart, discountTotal, cashReceived, paymentMethod, pointsToRedeem } = get();
        let subtotal = 0;
        let taxTotal = 0;
        let itemCount = 0;

        for (const item of cart) {
          itemCount += item.quantity;
          const lineSub = Math.round(item.quantity * item.unitPrice);
          const lineTax = Math.round((lineSub * item.taxRate) / 10000);
          subtotal += lineSub;
          taxTotal += lineTax;
        }

        // Loyalty redemption value in paise — we don't know pointValuePaise here, so
        // we expose pointsToRedeem and let the billing page compute the paise value
        // using the config it fetches. For grandTotal we just use discountTotal.
        const loyaltyDiscountPaise = 0; // placeholder; billing page injects this via discountTotal
        const grandTotal = Math.max(0, subtotal + taxTotal - discountTotal);
        const changeReturned =
          paymentMethod === 'CASH' && cashReceived > grandTotal
            ? cashReceived - grandTotal
            : 0;

        return {
          itemCount,
          subtotal,
          taxTotal,
          discountTotal,
          loyaltyDiscountPaise,
          grandTotal,
          changeReturned,
        };
      },
    }),
    {
      name: 'shop-pos-cart',
    }
  )
);
