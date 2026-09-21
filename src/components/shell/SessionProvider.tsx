'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    fetch('/api/v1/auth/me')
      .then((r) => r.json())
      .then((json) => { if (json.success) setUser(json.data); })
      .catch(() => {});
  }, [setUser]);

  return <>{children}</>;
}
