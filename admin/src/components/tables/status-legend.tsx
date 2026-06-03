'use client';

import { useTranslations } from 'next-intl';

import { TABLE_STATUSES } from '@/lib/tables/transitions';
import { STATUS_STYLE } from '@/lib/tables/status-style';

export function StatusLegend() {
  const t = useTranslations('tables');
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {t('legend')}
      </span>
      {TABLE_STATUSES.map((status) => (
        <span key={status} className="flex items-center gap-1.5 text-xs text-gray-700">
          <span className={`h-3 w-3 rounded-sm ${STATUS_STYLE[status].swatch}`} />
          {t(`status.${status}`)}
        </span>
      ))}
    </div>
  );
}
