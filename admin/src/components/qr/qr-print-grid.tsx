'use client';

import { QrCard } from '@/components/qr/qr-card';

export interface QrPrintItem {
  id: string;
  name: string;
  url: string;
}

/**
 * Grid of QR cards for the selected tables. Wrapped in `.qr-print-root` so the
 * print stylesheet (in globals.css) can isolate it from the admin chrome.
 */
export function QrPrintGrid({
  restaurantName,
  logoUrl,
  items,
}: {
  restaurantName: string;
  logoUrl?: string | null;
  items: QrPrintItem[];
}) {
  return (
    <div className="qr-print-root grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <QrCard
          key={item.id}
          restaurantName={restaurantName}
          logoUrl={logoUrl}
          tableName={item.name}
          url={item.url}
          showDownload
        />
      ))}
    </div>
  );
}
