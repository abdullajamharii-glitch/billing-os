import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'VIEWER';
  orgId: string;
  orgName: string;
  orgCurrency: string;
}

interface AuthStore {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      logout: async () => {
        await fetch('/api/v1/auth/logout', { method: 'POST' });
        set({ user: null });
        window.location.href = '/login';
      },
    }),
    { name: 'billing-os-auth' }
  )
);
