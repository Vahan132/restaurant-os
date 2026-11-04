'use client';

import { useTranslations } from 'next-intl';

import { InventoryLocationResponseSystemType } from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';

type Tone = 'green' | 'gray' | 'red' | 'amber' | 'blue';

const TYPE_TONE: Record<string, Tone> = {
  [InventoryLocationResponseSystemType.MAIN_STORAGE]: 'blue',
  [InventoryLocationResponseSystemType.KITCHEN]: 'amber',
  [InventoryLocationResponseSystemType.BAR]: 'green',
  [InventoryLocationResponseSystemType.CUSTOM]: 'gray',
};

/** Coloured badge for a location's system type (Kitchen / Bar / Storage / Custom). */
export function LocationTypeBadge({ systemType }: { systemType: string }) {
  const t = useTranslations('inventory');
  return <Badge tone={TYPE_TONE[systemType] ?? 'gray'}>{t(`locType${systemType}`)}</Badge>;
}

/** ACTIVE / ARCHIVED location status badge. */
export function LocationStatusBadge({ status }: { status: string }) {
  const t = useTranslations('inventory');
  const active = status === 'ACTIVE';
  return (
    <Badge tone={active ? 'green' : 'gray'}>
      {active ? t('locActive') : t('locArchived')}
    </Badge>
  );
}
