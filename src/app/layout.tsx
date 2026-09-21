import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'Billing OS',
  description: 'Professional billing and invoicing platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1c1917',
              color: '#fafaf9',
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              fontWeight: '500',
              borderRadius: '10px',
            },
            success: {
              iconTheme: { primary: '#15803d', secondary: '#f0fdf4' },
            },
            error: {
              iconTheme: { primary: '#b91c1c', secondary: '#fef2f2' },
            },
          }}
        />
      </body>
    </html>
  );
}
