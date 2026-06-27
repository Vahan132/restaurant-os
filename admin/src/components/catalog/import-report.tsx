'use client';

import { useTranslations } from 'next-intl';

import {
  CatalogReportResponseMode,
  type CatalogReportResponse,
} from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';

interface SectionError {
  message: string;
  ref?: string;
}
interface SectionCounters {
  created: number;
  updated: number;
  skipped: number;
  errors: SectionError[];
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : 0;
}

/** Defensively read a section's counters/errors from the opaque report payload. */
function readSection(value: unknown): SectionCounters {
  const o = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const rawErrors = Array.isArray(o.errors) ? o.errors : [];
  const errors: SectionError[] = rawErrors.map((e) => {
    if (typeof e === 'string') return { message: e };
    if (e && typeof e === 'object') {
      const eo = e as Record<string, unknown>;
      return {
        message: typeof eo.message === 'string' ? eo.message : JSON.stringify(eo),
        ref: typeof eo.ref === 'string' ? eo.ref : undefined,
      };
    }
    return { message: String(e) };
  });
  return {
    created: num(o.created),
    updated: num(o.updated),
    skipped: num(o.skipped),
    errors,
  };
}

/** Renders the per-section import/clone report (BR-7 §5). */
export function ImportReport({ report }: { report: CatalogReportResponse }) {
  const t = useTranslations('catalog');
  const sections = Object.entries(report.sections ?? {});

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge tone={report.mode === CatalogReportResponseMode.DRY_RUN ? 'amber' : 'blue'}>
          {report.mode === CatalogReportResponseMode.DRY_RUN ? t('dryRun') : t('applied')}
        </Badge>
        {!report.ok && <Badge tone="red">{t('fatalErrors')}</Badge>}
      </div>

      {!report.ok && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {t('fatalBlocksApply')}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2 font-medium">{t('section')}</th>
              <th className="px-3 py-2 font-medium">{t('created')}</th>
              <th className="px-3 py-2 font-medium">{t('updated')}</th>
              <th className="px-3 py-2 font-medium">{t('skipped')}</th>
              <th className="px-3 py-2 font-medium">{t('errors')}</th>
            </tr>
          </thead>
          <tbody>
            {sections.map(([name, value]) => {
              const s = readSection(value);
              return (
                <tr key={name} className="border-b border-gray-100 align-top">
                  <td className="px-3 py-2 font-medium capitalize text-gray-800">{name}</td>
                  <td className="px-3 py-2 text-green-700">{s.created}</td>
                  <td className="px-3 py-2 text-blue-700">{s.updated}</td>
                  <td className="px-3 py-2 text-gray-500">{s.skipped}</td>
                  <td className="px-3 py-2">
                    {s.errors.length === 0 ? (
                      <span className="text-gray-400">0</span>
                    ) : (
                      <ul className="space-y-1">
                        {s.errors.map((e, i) => (
                          <li
                            key={i}
                            className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700"
                          >
                            {e.ref ? <span className="font-medium">{e.ref}: </span> : null}
                            {e.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
