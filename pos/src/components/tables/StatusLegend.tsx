'use client';

import { useTranslations } from 'next-intl';
import { STATUS_ORDER, STATUS_TILE } from './statusColors';

export function StatusLegend() {
  const t = useTranslations('table.status');
  const tHome = useTranslations('home');

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <span className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        {tHome('legend')}
      </span>
      {STATUS_ORDER.map((status) => (
        <span key={status} className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <span className={`h-4 w-4 rounded ${STATUS_TILE[status]}`} />
          {t(status)}
        </span>
      ))}
    </div>
  );
}
