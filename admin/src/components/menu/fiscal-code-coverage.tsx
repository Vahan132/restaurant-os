'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { useItemsControllerUpdate } from '@/api/generated/menu-items/menu-items';
import { MenuItemResponseStatus, type MenuItemResponse } from '@/api/generated/model';
import { Can } from '@/components/auth/can';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/form';
import { getErrorMessage } from '@/lib/api-error';
import { usePermission } from '@/lib/auth/use-permission';
import { useAllMenuItems } from '@/lib/menu/use-all-items';
import { useCategories } from '@/lib/menu/use-categories';
import { useMenuInvalidation } from '@/lib/menu/use-menu-invalidation';
import { PERMISSIONS } from '@/lib/permissions';
import { toast } from '@/stores/toast';

// SRC ATG codes are numeric — soft-warn on obvious typos, but NEVER block save.
// SRC is the real validator (error 183 at fiscalization); we don't check the value
// against the (unimported) N 1406-Ն / N 875-Ն lists.
const ADG_CODE_RE = /^\d{4,15}$/;

// Three-state, per the reconciliation:
//  - 'coded'  (check) : a fiscalizable dish that has an adgCode.
//  - 'needs'  (warn)  : a fiscalizable dish with no code (the real work).
//  - 'na'     (dash)  : archived (status INACTIVE); never sold as a line, so no code
//                 is expected. This schema has no `isModifierOnly` on MenuItem
//                 (modifiers are separate entities), so INACTIVE is the only
//                 not-applicable case. n/a is EXCLUDED from the coverage denominator.
type Bucket = 'coded' | 'needs' | 'na';

/**
 * ADGCODE-UI: fiscal-code coverage — every dish with its ATG code and a three-state
 * status, a "missing only" filter, inline entry, and an honest "X / Y coded" count
 * (Y = fiscalizable dishes only). This is the data-entry workhorse for entering the
 * accountant's ATG list quickly.
 */
export function FiscalCodeCoverage() {
  const t = useTranslations('menu');
  const tc = useTranslations('common');
  const canManage = usePermission(PERMISSIONS.MENU_MANAGE);
  const { invalidateItems, invalidateMenuTree } = useMenuInvalidation();

  const { items, isLoading } = useAllMenuItems();
  const { categories } = useCategories({ includeInactive: true });
  const categoryName = useMemo(() => {
    const m = new Map(categories.map((c) => [c.id, c.name]));
    return (id: string) => m.get(id) ?? '—';
  }, [categories]);

  const [missingOnly, setMissingOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // Optimistic overlay so a saved row's status/count update instantly (the full
  // re-fetch of all pages then reconciles).
  const [overlay, setOverlay] = useState<Record<string, string | null>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const update = useItemsControllerUpdate();

  const effectiveCode = (item: MenuItemResponse): string | null =>
    item.id in overlay ? overlay[item.id]! : item.adgCode;

  const bucketOf = (item: MenuItemResponse): Bucket => {
    if (item.status !== MenuItemResponseStatus.ACTIVE) return 'na';
    return effectiveCode(item) ? 'coded' : 'needs';
  };

  // Honest denominator: fiscalizable (ACTIVE) dishes only; archived excluded.
  const fiscalizable = items.filter((i) => i.status === MenuItemResponseStatus.ACTIVE);
  const total = fiscalizable.length;
  const coded = fiscalizable.filter((i) => !!effectiveCode(i)).length;
  const needs = total - coded;
  const archivedCount = items.length - total;

  const rows = useMemo(() => {
    let list = showArchived
      ? items
      : items.filter((i) => i.status === MenuItemResponseStatus.ACTIVE);
    if (missingOnly) list = list.filter((i) => bucketOf(i) === 'needs');
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, missingOnly, showArchived, overlay]);

  const draftFor = (item: MenuItemResponse) =>
    item.id in drafts ? drafts[item.id]! : effectiveCode(item) ?? '';

  const isDirty = (item: MenuItemResponse) =>
    (draftFor(item).trim() || null) !== (effectiveCode(item) || null);

  const save = async (item: MenuItemResponse) => {
    const value = draftFor(item).trim();
    setSavingId(item.id);
    try {
      // Partial update: only adgCode is sent (empty string clears to null server-side).
      await update.mutateAsync({ id: item.id, data: { adgCode: value } });
      setOverlay((o) => ({ ...o, [item.id]: value || null }));
      setDrafts((d) => {
        const n = { ...d };
        delete n[item.id];
        return n;
      });
      await Promise.all([invalidateItems(), invalidateMenuTree()]);
      toast.success(t('adgCodeSaved'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  const statusBadge = (b: Bucket) =>
    b === 'coded' ? (
      <Badge tone="green">✓ {t('statusSet')}</Badge>
    ) : b === 'needs' ? (
      <Badge tone="amber">⚠ {t('statusNeedsCode')}</Badge>
    ) : (
      <Badge tone="gray">— {t('statusNa')}</Badge>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('fiscalCodesTitle')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('fiscalCodesSubtitle')}</p>
        </div>
        {!isLoading && (
          <div className="flex flex-col items-end gap-1">
            <Badge tone={total > 0 && coded === total ? 'green' : 'amber'}>
              {t('coverageCount', { coded, total })}
            </Badge>
            {needs > 0 && (
              <span className="text-xs text-amber-600">{t('needsCount', { count: needs })}</span>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center gap-4 border-b border-gray-200 px-4 py-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={missingOnly}
              onChange={(e) => setMissingOnly(e.target.checked)}
            />
            {t('missingOnly')}
          </label>
          {archivedCount > 0 && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              {t('showArchived')} ({archivedCount})
            </label>
          )}
        </div>

        <div className="overflow-x-auto p-4">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-md bg-gray-100" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              {missingOnly ? t('allCoded') : t('noItems')}
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-3 font-medium">{t('itemName')}</th>
                  <th className="py-2 pr-3 font-medium">{t('category')}</th>
                  <th className="py-2 pr-3 font-medium">{t('adgCode')}</th>
                  <th className="py-2 pr-3 font-medium">{t('status')}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const bucket = bucketOf(item);
                  const draft = draftFor(item);
                  const warn = !!draft.trim() && !ADG_CODE_RE.test(draft.trim());
                  return (
                    <tr key={item.id} className="border-b border-gray-100 align-top">
                      <td className="py-2 pr-3 font-medium text-gray-800">{item.name}</td>
                      <td className="py-2 pr-3 text-gray-600">{categoryName(item.categoryId)}</td>
                      <td className="py-2 pr-3">
                        <input
                          className={`${inputClass} max-w-[10rem] ${warn ? 'border-amber-400' : ''}`}
                          value={draft}
                          disabled={!canManage || savingId === item.id}
                          inputMode="numeric"
                          placeholder={t('adgCodePlaceholder')}
                          aria-label={`${t('adgCode')} — ${item.name}`}
                          onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && isDirty(item)) save(item);
                          }}
                        />
                        {warn && (
                          <span className="mt-1 block text-xs text-amber-600">
                            {t('adgCodeWarning')}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">{statusBadge(bucket)}</td>
                      <td className="py-2">
                        <div className="flex justify-end">
                          <Can permission={PERMISSIONS.MENU_MANAGE}>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={!isDirty(item) || savingId === item.id}
                              onClick={() => save(item)}
                            >
                              {tc('save')}
                            </Button>
                          </Can>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
