'use client';

import Sidebar from './Sidebar';
import SessionProvider from './SessionProvider';

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="flex h-screen bg-bg-base overflow-hidden font-sans print:h-auto print:overflow-visible print:bg-white">
        <div className="print:hidden">
          <Sidebar />
        </div>
        <main className="flex-1 overflow-y-auto print:overflow-visible print:w-full">
          {children}
        </main>
      </div>
    </SessionProvider>
  );
}
