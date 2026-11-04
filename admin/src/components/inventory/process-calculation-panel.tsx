'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

import type { InventoryItemResponse } from '@/api/generated/model';
import { itemDisplayName } from '@/lib/inventory/display-name';
import {
  BASE_UNIT_ABBR,
  formatNumber,
  largestAlternate,
  type BaseUnit,
} from '@/lib/inventory/units';
import { formatMoney } from '@/lib/money';

export interface CalcInput {
  itemId: string;
  /** Per 1× batch, base units. */
  baseQty: number;
}

export interface CalcOutput {
  itemId: string;
  /** Per 1× batch, base units. */
  baseQty: number;
  isPrimary: boolean;
  costShareBps: number | null;
}

const abbr = (u: string) => BASE_UNIT_ABBR[u as BaseUnit] ?? u;

/** "2,000 ml (2 L)" — base qty plus the item's largest alternate unit when it helps. */
function qtyLabel(qty: number, item: InventoryItemResponse | undefined): string {
  if (!item) return formatNumber(qty);
  const base = `${formatNumber(qty)} ${abbr(item.baseUnit)}`;
  const alt = largestAlternate(item.alternateUnits);
  if (!alt || Math.abs(qty) < alt.factor) return base;
  return `${base} (${formatNumber(qty / alt.factor)} ${alt.name})`;
}

/** Friendly "per" unit for an output: its largest alternate unit, else 1 base unit. */
function perUnit(item: InventoryItemResponse | undefined): { label: string; factor: number } {
  if (!item) return { label: '', factor: 1 };
  const alt = largestAlternate(item.alternateUnits);
  if (alt && item.baseUnit !== 'PIECE') return { label: alt.name, factor: alt.factor };
  return { label: abbr(item.baseUnit), factor: 1 };
}

/**
 * Shows step by step how a process turns its inputs into outputs: what goes in
 * (with unit conversions and current batch cost), how the batch cost is split
 * across outputs, the resulting cost per output unit, how much of each input one
 * output unit consumes, and the yield/loss when units are comparable
 * (e.g. 2 L milk + 200 g sugar -> 10 pc yogurt: 1 pc = 200 ml milk + 20 g sugar).
 */
export function ProcessCalculationPanel({
  inputs,
  outputs,
  processingCost,
  multiplier = 1,
  itemById,
  unitCost,
  currency,
}: {
  inputs: CalcInput[];
  outputs: CalcOutput[];
  processingCost: number;
  multiplier?: number;
  itemById: Map<string, InventoryItemResponse>;
  unitCost: (itemId: string) => number;
  currency: string;
}) {
  const t = useTranslations('inventory');
  const locale = useLocale();
  const m = Math.max(1, multiplier);

  const calc = useMemo(() => {
    const ins = inputs
      .filter((i) => i.itemId && i.baseQty > 0)
      .map((i) => {
        const qty = i.baseQty * m;
        const uc = unitCost(i.itemId);
        return { ...i, qty, unitCost: uc, cost: qty * uc };
      });
    const outs = outputs.filter((o) => o.itemId && o.baseQty > 0);
    const inputsCost = ins.reduce((s, i) => s + i.cost, 0);
    const batchCost = inputsCost + processingCost;
    const allShared = outs.length > 0 && outs.every((o) => o.costShareBps != null);
    const outRows = outs.map((o) => {
      const qty = o.baseQty * m;
      const shareBps = allShared ? (o.costShareBps as number) : o.isPrimary ? 10000 : 0;
      const allocated = (batchCost * shareBps) / 10000;
      return { ...o, qty, shareBps, allocated, costPerBase: qty > 0 ? allocated / qty : 0 };
    });

    // Yield / loss: compare total input vs total output per base unit dimension.
    const byUnit = new Map<string, { in: number; out: number }>();
    for (const i of ins) {
      const u = itemById.get(i.itemId)?.baseUnit;
      if (!u) continue;
      const e = byUnit.get(u) ?? { in: 0, out: 0 };
      e.in += i.qty;
      byUnit.set(u, e);
    }
    for (const o of outRows) {
      const u = itemById.get(o.itemId)?.baseUnit;
      if (!u) continue;
      const e = byUnit.get(u) ?? { in: 0, out: 0 };
      e.out += o.qty;
      byUnit.set(u, e);
    }
    const yields = [...byUnit.entries()]
      .filter(([, v]) => v.in > 0 && v.out > 0)
      .map(([unit, v]) => ({ unit, in: v.in, out: v.out, pct: (v.out / v.in) * 100 }));

    return { ins, outRows, inputsCost, batchCost, yields };
  }, [inputs, outputs, processingCost, m, unitCost, itemById]);

  const name = (id: string) => {
    const it = itemById.get(id);
    return it ? itemDisplayName(it, locale) : '…';
  };

  if (calc.ins.length === 0 && calc.outRows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 p-3 text-xs text-gray-500">
        {t('calcEmpty')}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-gray-800">{t('calcTitle')}</h3>
        {m > 1 && <span className="text-xs text-gray-500">{t('calcMultiplier', { n: m })}</span>}
      </div>

      {/* 1. What goes in */}
      <section>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          1 · {t('calcIn')}
        </p>
        <table className="mt-1 w-full text-xs">
          <thead className="text-gray-400">
            <tr>
              <th className="py-1 text-left font-normal">{t('calcItem')}</th>
              <th className="py-1 text-right font-normal">{t('calcQty')}</th>
              <th className="py-1 text-right font-normal">{t('calcUnitCost')}</th>
              <th className="py-1 text-right font-normal">{t('calcCost')}</th>
            </tr>
          </thead>
          <tbody className="text-gray-700">
            {calc.ins.map((i, idx) => {
              const it = itemById.get(i.itemId);
              const pu = perUnit(it);
              return (
                <tr key={idx} className="border-t border-gray-200">
                  <td className="py-1">{name(i.itemId)}</td>
                  <td className="py-1 text-right">{qtyLabel(i.qty, it)}</td>
                  <td className="py-1 text-right text-gray-500">
                    {i.unitCost > 0 ? (
                      `${formatMoney(i.unitCost * pu.factor, currency)} / ${pu.label}`
                    ) : (
                      <span className="text-amber-600">{t('calcNoCost')}</span>
                    )}
                  </td>
                  <td className="py-1 text-right">{formatMoney(i.cost, currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* 2. Batch cost */}
      <section className="rounded bg-white px-2 py-1.5 text-xs text-gray-700">
        <div className="flex justify-between">
          <span>{t('calcInputsTotal')}</span>
          <span>{formatMoney(calc.inputsCost, currency)}</span>
        </div>
        <div className="flex justify-between">
          <span>+ {t('calcProcessing')}</span>
          <span>{formatMoney(processingCost, currency)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-gray-200 pt-1 font-medium text-gray-900">
          <span>= {t('calcBatchCost')}</span>
          <span>{formatMoney(calc.batchCost, currency)}</span>
        </div>
      </section>

      {/* 3. What comes out + cost per unit */}
      <section>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          2 · {t('calcOut')}
        </p>
        <ul className="mt-1 space-y-2">
          {calc.outRows.map((o, idx) => {
            const it = itemById.get(o.itemId);
            const pu = perUnit(it);
            return (
              <li key={idx} className="rounded border border-gray-200 bg-white p-2 text-xs">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-gray-900">
                    {name(o.itemId)} · {qtyLabel(o.qty, it)}
                  </span>
                  <span className="text-gray-500">
                    {t('calcShare', { pct: formatNumber(o.shareBps / 100, 2) })} ={' '}
                    {formatMoney(o.allocated, currency)}
                  </span>
                </div>
                <div className="mt-1 text-gray-700">
                  {t('calcCostPer', { unit: pu.label })}:{' '}
                  <span className="font-medium">
                    {formatMoney(o.costPerBase * pu.factor, currency)}
                  </span>
                  <span className="text-gray-400">
                    {' '}
                    ({formatMoney(o.allocated, currency)} ÷ {qtyLabel(o.qty, it)})
                  </span>
                </div>
                {calc.ins.length > 0 && o.qty > 0 && (
                  <div className="mt-1 text-gray-600">
                    {t('calcOneUses', { unit: pu.label, name: name(o.itemId) })}{' '}
                    {calc.ins
                      .map((i) => {
                        const ii = itemById.get(i.itemId);
                        const per = (i.qty / o.qty) * pu.factor;
                        return `${formatNumber(per, 2)} ${abbr(ii?.baseUnit ?? '')} ${name(i.itemId)}`;
                      })
                      .join(' + ')}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* 4. Conversion / yield */}
      {(calc.yields.length > 0 || (calc.ins.length > 0 && calc.outRows.length > 0)) && (
        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            3 · {t('calcConversion')}
          </p>
          <p className="mt-1 text-xs text-gray-700">
            {calc.ins
              .map((i) => qtyLabel(i.qty, itemById.get(i.itemId)) + ' ' + name(i.itemId))
              .join(' + ')}
            {' → '}
            {calc.outRows
              .map((o) => qtyLabel(o.qty, itemById.get(o.itemId)) + ' ' + name(o.itemId))
              .join(' + ')}
          </p>
          {calc.yields.map((y) => (
            <p key={y.unit} className="mt-0.5 text-xs text-gray-600">
              {t('calcYield', {
                unit: abbr(y.unit),
                in: formatNumber(y.in),
                out: formatNumber(y.out),
                pct: formatNumber(y.pct, 1),
                loss: formatNumber(Math.max(0, 100 - y.pct), 1),
              })}
            </p>
          ))}
        </section>
      )}

      <p className="text-[11px] text-gray-400">{t('calcHint')}</p>
    </div>
  );
}
