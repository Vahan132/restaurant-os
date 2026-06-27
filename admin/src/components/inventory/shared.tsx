'use client';

import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/** RAW / PROCESSED badge used on stock + items rows. */
export function KindBadge({ kind }: { kind: string }) {
  const t = useTranslations('inventory');
  const raw = kind === 'RAW';
  return (
    <Badge tone={raw ? 'gray' : 'blue'}>
      {raw ? t('kindRaw') : t('kindProcessed')}
    </Badge>
  );
}

/** Amber "low stock" badge. */
export function LowStockBadge() {
  const t = useTranslations('inventory');
  return <Badge tone="amber">{t('lowStock')}</Badge>;
}

/** OPEN / DEPLETED layer status badge. */
export function LayerStatusBadge({ status }: { status: string }) {
  const t = useTranslations('inventory');
  const open = status === 'OPEN';
  return (
    <Badge tone={open ? 'green' : 'gray'}>
      {open ? t('statusOpen') : t('statusDepleted')}
    </Badge>
  );
}

/** Shared prev/next pager matching the existing list screens. */
export function Pagination({
  page,
  onPrev,
  onNext,
  hasNext,
  isFetching,
}: {
  page: number;
  onPrev: () => void;
  onNext: () => void;
  hasNext: boolean;
  isFetching?: boolean;
}) {
  const t = useTranslations('inventory');
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">
        {t('page', { page })}
        {isFetching ? ' …' : ''}
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={onPrev} disabled={page <= 1}>
          {t('prev')}
        </Button>
        <Button size="sm" variant="secondary" onClick={onNext} disabled={!hasNext}>
          {t('next')}
        </Button>
      </div>
    </div>
  );
}

/** Date-only display (e.g. expiry / received), locale-aware. Returns "—" when empty. */
export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(d);
}

/** Date + time display for the movement ledger. */
export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
