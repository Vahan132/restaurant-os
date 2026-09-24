'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import {
  useRecipesControllerCreate,
  useRecipesControllerUpdate,
} from '@/api/generated/inventory-recipes/inventory-recipes';
import type {
  CreateRecipeDto,
  ModifierConsumptionDto,
  RecipeLineDto,
  InventoryItemResponse,
  ModifierOptionResponse,
  RecipeWarningResponse,
  UpdateRecipeDto,
} from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/form';
import { RecipeLineRow, type RecipeLineState } from '@/components/inventory/recipe-line-row';
import { getErrorMessage } from '@/lib/api-error';
import { itemDisplayName } from '@/lib/inventory/display-name';
import { useItemsForSelect } from '@/lib/inventory/use-inventory-data';
import { useUnitCostMap } from '@/lib/inventory/use-process-data';
import {
  useRecipeForMenuItem,
  useRecipesInvalidation,
} from '@/lib/inventory/use-recipe-data';
import { BASE_UNIT_ABBR, formatNumber, type BaseUnit } from '@/lib/inventory/units';
import { formatMoney } from '@/lib/money';
import { toast } from '@/stores/toast';
import { Badge } from '@/components/ui/badge';
import { Toggle } from '@/components/ui/toggle';
import { useItemsControllerUpdate } from '@/api/generated/menu-items/menu-items';

interface MappingState {
  modifierOptionId: string;
  itemId: string;
  baseQty: string;
}

export function RecipeCostPanel({
  menuItemId,
  currency,
  modifierOptions,
  canManage,
}: {
  menuItemId: string;
  currency: string;
  modifierOptions: ModifierOptionResponse[];
  canManage: boolean;
}) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { recipeId, recipe, isLoading, isFetched } = useRecipeForMenuItem(menuItemId);
  const { items } = useItemsForSelect();
  const { unitCost } = useUnitCostMap();
  const invalidate = useRecipesInvalidation();

  const [started, setStarted] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [lines, setLines] = useState<RecipeLineState[]>([{ itemId: '', baseQty: '', netQty: '' }]);
  const [mappings, setMappings] = useState<MappingState[]>([]);
  const [warnings, setWarnings] = useState<RecipeWarningResponse[]>([]);
  const [hideRecipe, setHideRecipe] = useState(false);

  const create = useRecipesControllerCreate();
  const update = useRecipesControllerUpdate();
  const updateItem = useItemsControllerUpdate();
  const submitting = create.isPending || update.isPending;

  // Hydrate from the loaded recipe once.
  useEffect(() => {
    if (hydrated || !recipe) return;
    setLines(
      recipe.lines.length
        ? recipe.lines.map((l) => ({
            itemId: l.itemId,
            baseQty: String(l.baseQty),
            netQty: l.netQty != null ? String(l.netQty) : '',
          }))
        : [{ itemId: '', baseQty: '', netQty: '' }],
    );
    setMappings(
      recipe.modifierConsumptions.map((m) => ({
        modifierOptionId: m.modifierOptionId,
        itemId: m.itemId,
        baseQty: String(m.baseQty),
      })),
    );
    setWarnings(recipe.warnings ?? []);
    setHideRecipe(recipe.hideRecipe ?? false);
    setStarted(true);
    setHydrated(true);
  }, [hydrated, recipe]);

  const itemById = useMemo(() => {
    const m = new Map<string, InventoryItemResponse>();
    for (const i of items) m.set(i.id, i);
    return m;
  }, [items]);

  // BRUTTO-1: portion totals per base unit (brutto taken from stock vs netto in the dish).
  const portion = useMemo(() => {
    const acc = new Map<string, { gross: number; net: number }>();
    for (const l of lines) {
      const it = itemById.get(l.itemId);
      const g = Number(l.baseQty);
      if (!it || !Number.isFinite(g) || g <= 0) continue;
      const n = l.netQty.trim() === '' ? g : Number(l.netQty);
      const e = acc.get(it.baseUnit) ?? { gross: 0, net: 0 };
      e.gross += g;
      e.net += Number.isFinite(n) ? n : g;
      acc.set(it.baseUnit, e);
    }
    return [...acc.entries()];
  }, [lines, itemById]);

  // Live (client-side) estimated cost preview from current lines.
  const livePreview = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const q = Number(l.baseQty);
        return sum + (l.itemId && Number.isFinite(q) ? q * unitCost(l.itemId) : 0);
      }, 0),
    [lines, unitCost],
  );

  const setLine = (i: number, patch: Partial<RecipeLineState>) =>
    setLines((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const setMapping = (i: number, patch: Partial<MappingState>) =>
    setMappings((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const onToggleHideRecipe = async (next: boolean) => {
    setHideRecipe(next); // optimistic
    try {
      await updateItem.mutateAsync({ id: menuItemId, data: { hideRecipe: next } });
      await invalidate(recipeId ?? undefined);
      toast.success(t('hideRecipeSaved'));
    } catch (err) {
      setHideRecipe(!next); // revert
      toast.error(getErrorMessage(err));
    }
  };

  const save = async () => {
    const linesDto: RecipeLineDto[] = [];
    for (const l of lines) {
      const q = Number(l.baseQty);
      if (!l.itemId || !Number.isFinite(q) || q <= 0) continue;
      const dto: RecipeLineDto = { itemId: l.itemId, baseQty: Math.round(q) };
      if (l.netQty.trim() !== '') {
        const n = Number(l.netQty);
        // BRUTTO-1: netto must be a positive whole base unit and never above brutto.
        if (!Number.isFinite(n) || n <= 0 || n > q) {
          toast.error(t('rlNetTooBig'));
          return;
        }
        if (Math.round(n) !== Math.round(q)) dto.netQty = Math.round(n);
      }
      linesDto.push(dto);
    }
    const mappingsDto: ModifierConsumptionDto[] = [];
    for (const m of mappings) {
      const q = Number(m.baseQty);
      if (m.modifierOptionId && m.itemId && Number.isFinite(q) && q > 0) {
        mappingsDto.push({ modifierOptionId: m.modifierOptionId, itemId: m.itemId, baseQty: q });
      }
    }
    try {
      if (recipeId) {
        const data: UpdateRecipeDto = { lines: linesDto, modifierConsumptions: mappingsDto };
        const res = await update.mutateAsync({ id: recipeId, data });
        setWarnings(res?.warnings ?? []);
        await invalidate(recipeId);
      } else {
        const data: CreateRecipeDto = {
          menuItemId,
          lines: linesDto,
          modifierConsumptions: mappingsDto,
        };
        const res = await create.mutateAsync({ data });
        setWarnings(res?.warnings ?? []);
        await invalidate(res?.id);
      }
      toast.success(t('recipeSaved'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (isLoading && !isFetched) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-9 animate-pulse rounded-md bg-gray-100" />
        ))}
      </div>
    );
  }

  // Empty state: no recipe and the user hasn't started one.
  if (!recipeId && !started) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 p-6 text-center">
        <p className="text-sm text-gray-500">{t('recipeEmpty')}</p>
        {canManage && (
          <Button variant="primary" className="mt-3" onClick={() => setStarted(true)}>
            + {t('addRecipe')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((w, i) => {
            const cp = w.counterparts[0];
            return (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800"
              >
                <span>
                  {w.type === 'HAS_PROCESSED_COUNTERPART'
                    ? t('rawProcessedWarn')
                    : t('rawSourceWarn')}
                </span>
                {canManage && cp && (
                  <button
                    type="button"
                    className="ml-auto shrink-0 font-medium underline hover:no-underline"
                    onClick={() =>
                      setLines((rows) =>
                        rows.map((r) =>
                          r.itemId === w.itemId ? { ...r, itemId: cp.itemId } : r,
                        ),
                      )
                    }
                  >
                    {t('switchTo', { name: itemDisplayName(cp, locale) })}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recipe lines */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700">{t('recipeLines')}</h4>
          {canManage && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setLines((r) => [...r, { itemId: '', baseQty: '', netQty: '' }])}
            >
              + {t('rlAddLine')}
            </Button>
          )}
        </div>
        {lines.map((line, i) => (
          <RecipeLineRow
            key={i}
            line={line}
            items={items}
            itemById={itemById}
            disabled={!canManage}
            onChange={(patch) => setLine(i, patch)}
            onRemove={() =>
              setLines((r) => (r.length === 1 ? r : r.filter((_, idx) => idx !== i)))
            }
            onSwitch={(cid) => setLine(i, { itemId: cid })}
            unitCost={unitCost}
            currency={currency}
          />
        ))}
      </div>

      {/* Modifier consumption mappings */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700">{t('modMappings')}</h4>
          {canManage && modifierOptions.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                setMappings((r) => [...r, { modifierOptionId: '', itemId: '', baseQty: '' }])
              }
            >
              + {t('mmAddLine')}
            </Button>
          )}
        </div>
        <p className="text-xs text-gray-500">{t('modMappingHint')}</p>
        {modifierOptions.length === 0 ? (
          <p className="text-xs text-gray-400">{t('noModifierOptions')}</p>
        ) : (
          mappings.map((m, i) => {
            return (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <select
                    className={inputClass}
                    value={m.modifierOptionId}
                    disabled={!canManage}
                    onChange={(e) => setMapping(i, { modifierOptionId: e.target.value })}
                  >
                    <option value="">{t('mmOption')}</option>
                    {modifierOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <select
                    className={inputClass}
                    value={m.itemId}
                    disabled={!canManage}
                    onChange={(e) => setMapping(i, { itemId: e.target.value })}
                  >
                    <option value="">{t('mmItem')}</option>
                    {items.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {itemDisplayName(opt, locale)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-28">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    className={inputClass}
                    placeholder={t('mmQty')}
                    value={m.baseQty}
                    disabled={!canManage}
                    onChange={(e) => setMapping(i, { baseQty: e.target.value })}
                  />
                </div>
                {!canManage ? null : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setMappings((r) => r.filter((_, idx) => idx !== i))}
                  >
                    ×
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Estimated cost */}
      <div className="rounded-md bg-gray-50 p-3 text-sm">
        <div className="flex justify-between">
          <span className="font-medium text-gray-700">{t('estUnitCost')}</span>
          <span className="text-gray-900">
            {formatMoney(recipe?.estimatedUnitCost_amount ?? livePreview, currency)}
          </span>
        </div>
        {recipe && Math.round(livePreview) !== Math.round(recipe.estimatedUnitCost_amount) && (
          <div className="mt-1 flex justify-between text-xs text-gray-400">
            <span>≈</span>
            <span>{formatMoney(livePreview, currency)}</span>
          </div>
        )}
        {portion.length > 0 && (
          <div className="mt-2 space-y-0.5 border-t border-gray-200 pt-2 text-xs text-gray-600">
            {portion.map(([u, v]) => (
              <div key={u} className="flex justify-between">
                <span>{t('portionTotals', { unit: BASE_UNIT_ABBR[u as BaseUnit] ?? u })}</span>
                <span>
                  {t('portionBruttoNetto', {
                    gross: formatNumber(v.gross),
                    net: formatNumber(v.net),
                    unit: BASE_UNIT_ABBR[u as BaseUnit] ?? u,
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-gray-400">{t('estUnitCostHint')}</p>
      </div>

      {/* COST-FIFO-1: dish cost-price history (new supplier batches starting to be used). */}
      {recipe && (recipe.costHistory ?? []).length > 0 && (
        <div className="rounded-md border border-gray-200 p-3 text-sm">
          <h4 className="text-sm font-semibold text-gray-700">{t('costHistoryTitle')}</h4>
          <ul className="mt-2 space-y-1 text-xs">
            {(recipe.costHistory ?? []).map((c) => {
              const up = c.oldCost_amount != null && c.newCost_amount > c.oldCost_amount;
              const cause = c.causeItemId ? itemById.get(c.causeItemId) : undefined;
              return (
                <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-gray-500">
                    {new Date(c.occurredAt).toLocaleString(locale)}
                    {cause && (
                      <span className="text-gray-400">
                        {' '}
                        · {t('costChangeCause', { name: itemDisplayName(cause, locale) })}
                      </span>
                    )}
                  </span>
                  <span className={up ? 'text-red-600' : 'text-green-700'}>
                    {c.oldCost_amount != null ? formatMoney(c.oldCost_amount, currency) : '—'} →{' '}
                    {formatMoney(c.newCost_amount, currency)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}


      {/* CATALOG-3: hideRecipe toggle + what-customers-see preview. */}
      {recipe && (
        <div className="space-y-3 rounded-md border border-gray-200 p-3">
          <Toggle
            label={t('hideRecipeLabel')}
            description={t('hideRecipeDesc')}
            checked={hideRecipe}
            disabled={!canManage || updateItem.isPending}
            onChange={onToggleHideRecipe}
          />
          <div>
            <p className="text-xs font-medium text-gray-500">{t('customerPreviewTitle')}</p>
            {hideRecipe ? (
              <p className="mt-1 text-xs text-gray-400">{t('customerPreviewHidden')}</p>
            ) : (recipe.customerIngredients ?? []).length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {(recipe.customerIngredients ?? []).map((ci) => (
                  <Badge key={ci.itemId} tone="gray">
                    {itemDisplayName(ci, locale)}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-gray-400">{t('customerPreviewEmpty')}</p>
            )}
          </div>
        </div>
      )}

      {canManage && (
        <div className="flex justify-end">
          <Button variant="primary" onClick={save} disabled={submitting}>
            {tc('save')}
          </Button>
        </div>
      )}
    </div>
  );
}
