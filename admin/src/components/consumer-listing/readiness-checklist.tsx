'use client';

import { useTranslations } from 'next-intl';

import {
  extraMissing,
  humanizeKey,
  parseCompleteness,
  READINESS_ITEMS,
} from '@/lib/consumer-listing/completeness';

function Row({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          ok ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
        }`}
        aria-hidden
      >
        {ok ? '✓' : '✗'}
      </span>
      <span className={ok ? 'text-gray-700' : 'text-gray-500'}>{label}</span>
    </li>
  );
}

/**
 * Live readiness checklist derived from the branch `completeness` gate (which
 * covers both brand and branch fields). Drives the disabled state of the
 * listed toggle in the parent.
 */
export function ReadinessChecklist({ completeness }: { completeness: unknown }) {
  const t = useTranslations('consumerListing');
  const parsed = parseCompleteness(completeness);
  const missing = new Set(parsed.missing);

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {t('checklist.title')}
      </p>
      <ul className="space-y-1.5">
        {READINESS_ITEMS.map((item) => (
          <Row
            key={item.key}
            ok={!missing.has(item.key)}
            label={t(item.labelKey)}
          />
        ))}
        {extraMissing(parsed.missing).map((key) => (
          <Row key={key} ok={false} label={humanizeKey(key)} />
        ))}
      </ul>
      {!parsed.isComplete && (
        <p className="mt-2 text-xs text-gray-500">{t('checklist.goLiveHint')}</p>
      )}
    </div>
  );
}
