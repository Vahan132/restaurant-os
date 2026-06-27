'use client';

import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';

type Tone = 'green' | 'gray' | 'red' | 'amber' | 'blue';

/** Colour-coded reason badges. */
const REASON_TONE: Record<string, Tone> = {
  STAFF_MEAL: 'blue',
  SPOILAGE: 'amber',
  WASTE: 'amber',
  BREAKAGE: 'red',
  THEFT: 'red',
  OTHER: 'gray',
};

export function ReasonBadge({ reason }: { reason: string }) {
  const t = useTranslations('inventory');
  return <Badge tone={REASON_TONE[reason] ?? 'gray'}>{t(`reason${reason}`)}</Badge>;
}

/** "2 items", "3 dishes", "mixed", or "—" line summary. */
export function useLineSummary() {
  const t = useTranslations('inventory');
  return (itemCount: number, dishCount: number): string => {
    if (itemCount > 0 && dishCount > 0) return t('lineMixed');
    if (itemCount > 0) return t('lineItems', { count: itemCount });
    if (dishCount > 0) return t('lineDishes', { count: dishCount });
    return '—';
  };
}
