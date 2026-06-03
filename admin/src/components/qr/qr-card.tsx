'use client';

import { QRCodeCanvas } from 'qrcode.react';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';

import { Button } from '@/components/ui/button';

/**
 * A single printable QR card: restaurant name/logo, table name, the QR for the
 * customer URL, and a "scan to view the menu" caption. Optional PNG download.
 */
export function QrCard({
  restaurantName,
  logoUrl,
  tableName,
  url,
  showDownload = false,
}: {
  restaurantName: string;
  logoUrl?: string | null;
  tableName: string;
  url: string;
  showDownload?: boolean;
}) {
  const t = useTranslations('qr');
  const ref = useRef<HTMLDivElement>(null);

  const downloadPng = () => {
    const canvas = ref.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `qr-${tableName}.png`.replace(/\s+/g, '-').toLowerCase();
    a.click();
  };

  return (
    <div className="qr-card flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-white p-4 text-center">
      <div className="flex h-8 items-center justify-center">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={restaurantName} className="max-h-8 object-contain" />
        ) : (
          <span className="text-sm font-semibold text-gray-900">{restaurantName}</span>
        )}
      </div>
      <div ref={ref}>
        <QRCodeCanvas value={url} size={160} includeMargin level="M" />
      </div>
      <p className="text-base font-semibold text-gray-900">{tableName}</p>
      <p className="text-xs text-gray-500">{t('caption')}</p>
      {showDownload && (
        <Button size="sm" variant="secondary" className="qr-no-print" onClick={downloadPng}>
          {t('downloadPng')}
        </Button>
      )}
    </div>
  );
}
