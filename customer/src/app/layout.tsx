import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';

import { CartProvider } from '@/components/cart/CartProvider';
import Providers from '@/components/Providers';
import TenantProvider from '@/components/TenantProvider';

import './globals.css';

export const metadata: Metadata = {
  title: 'Menu',
  description: 'Browse the menu',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#ffffff',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="min-h-screen text-gray-900 antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <TenantProvider>
            <Providers>
              <CartProvider>{children}</CartProvider>
            </Providers>
          </TenantProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
