'use client';

import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';

type Tone = 'green' | 'gray' | 'red' | 'amber' | 'blue';

const TONE: Record<string, Tone> = {
  STAFF: 'gray',
  PUBLIC: 'blue',
  PHONE: 'amber',
};

/** STAFF / PUBLIC / PHONE reservation source badge. */
export function SourceBadge({ source }: { source: string }) {
  const t = useTranslations('reservations');
  return <Badge tone={TONE[source] ?? 'gray'}>{t(`source${source}`)}</Badge>;
}
