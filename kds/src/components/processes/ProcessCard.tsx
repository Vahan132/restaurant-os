'use client';

import { memo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ProcessResponse, StockRowResponseBaseUnit } from '@/api/generated/model';
import type { StockIndex } from '@/lib/kds/useProcesses';

interface Props {
  process: ProcessResponse;
  stockIndex: StockIndex;
  canRun: boolean;
  pending: boolean;
  onRun: (id: string, multiplier: number) => void;
}

/** Trim trailing zeros so 250.00 -> "250" but 12.50 -> "12.5". */
function formatNumber(n: number): string {
  return Number(n.toFixed(2)).toString();
}

/** Quantity with its base-unit symbol (g / ml / pcs), localized. */
function useFormatQty() {
  const u = useTranslations('processes.units');
  return (qty: number, unit: StockRowResponseBaseUnit) =>
    `${formatNumber(qty)} ${u(unit)}`;
}

function ProcessCardBase({ process, stockIndex, canRun, pending, onRun }: Props) {
  const t = useTranslations('processes');
  const formatQty = useFormatQty();
  const [multiplier, setMultiplier] = useState(1);

  const dec = () => setMultiplier((m) => Math.max(1, m - 1));
  const inc = () => setMultiplier((m) => m + 1);

  return (
    <article className="flex flex-col gap-3 rounded-2xl border-4 border-kiosk-border bg-kiosk-panel p-4">
      <header className="min-w-0">
        <h3 className="truncate text-kiosk-lg font-bold">{process.name}</h3>
        {process.note && (
          <p className="truncate text-base text-kiosk-muted">{process.note}</p>
        )}
      </header>

      {/* Inputs it will consume, with on-hand + low/short signals. */}
      <section className="flex flex-col gap-2">
        <span className="text-base font-semibold uppercase tracking-wide text-kiosk-muted">
          {t('uses')}
        </span>
        <ul className="flex flex-col gap-1.5">
          {process.inputs.map((input) => {
            const info = stockIndex.get(input.itemId);
            const need = input.baseQty * multiplier;
            const willShort = info ? need > info.onHandBase : false;
            const low = info?.lowStock ?? false;
            return (
              <li
                key={input.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-kiosk-bg px-3 py-2"
              >
                <span className="min-w-0 truncate text-kiosk">
                  {info?.name ?? t('unknownItem')}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {info && (
                    <span className="text-base text-kiosk-muted">
                      {t('onHand', { qty: formatQty(info.onHandBase, info.baseUnit) })}
                    </span>
                  )}
                  <span className="text-kiosk font-bold">
                    {info ? formatQty(need, info.baseUnit) : formatNumber(need)}
                  </span>
                  {willShort ? (
                    <span className="rounded bg-status-delayed/20 px-2 py-0.5 text-sm font-bold text-status-delayed">
                      {t('short')}
                    </span>
                  ) : low ? (
                    <span className="rounded bg-status-preparing/20 px-2 py-0.5 text-sm font-bold text-status-preparing">
                      {t('low')}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
          {process.inputs.length === 0 && (
            <li className="text-base text-kiosk-muted">{t('noInputs')}</li>
          )}
        </ul>
      </section>

      {/* Output it produces. */}
      <section className="flex flex-col gap-2">
        <span className="text-base font-semibold uppercase tracking-wide text-kiosk-muted">
          {t('makes')}
        </span>
        <ul className="flex flex-col gap-1.5">
          {process.outputs.map((output) => {
            const info = stockIndex.get(output.itemId);
            const produced = output.baseQty * multiplier;
            return (
              <li
                key={output.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-status-ready/10 px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-kiosk">
                    {info?.name ?? t('unknownItem')}
                  </span>
                  {output.isPrimary && (
                    <span className="shrink-0 rounded bg-status-ready/25 px-2 py-0.5 text-sm font-bold text-status-ready">
                      {t('primary')}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-kiosk font-bold text-status-ready">
                  +{info ? formatQty(produced, info.baseUnit) : formatNumber(produced)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {canRun && (
        <footer className="mt-auto flex items-center gap-3 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={dec}
              disabled={multiplier <= 1 || pending}
              aria-label={t('decrease')}
              className="h-12 w-12 rounded-lg border border-kiosk-border text-kiosk-xl font-bold leading-none hover:bg-kiosk-border disabled:opacity-40"
            >
              −
            </button>
            <span className="w-12 text-center text-kiosk-lg font-bold tabular-nums">
              ×{multiplier}
            </span>
            <button
              type="button"
              onClick={inc}
              disabled={pending}
              aria-label={t('increase')}
              className="h-12 w-12 rounded-lg border border-kiosk-border text-kiosk-xl font-bold leading-none hover:bg-kiosk-border disabled:opacity-40"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={() => onRun(process.id, multiplier)}
            disabled={pending}
            className="flex-1 rounded-lg bg-status-ready px-4 py-3 text-kiosk font-bold text-black disabled:opacity-50"
          >
            {pending ? t('running') : t('run')}
          </button>
        </footer>
      )}
    </article>
  );
}

export const ProcessCard = memo(ProcessCardBase);
