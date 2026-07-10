'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import {
  useItemsControllerAttachModifierGroup,
  useItemsControllerDetachModifierGroup,
  useItemsControllerReorderModifierGroups,
  useItemsControllerSetModifierGroupOverrides,
} from '@/api/generated/menu-items/menu-items';
import {
  ModifierGroupResponseSelectionType,
  ModifierOptionResponseStatus,
  type AttachedModifierGroupResponse,
  type ModifierGroupResponse,
} from '@/api/generated/model';
import { Can } from '@/components/auth/can';
import { ModifierGroupFormModal } from '@/components/menu/modifier-group-form-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { useConfirm } from '@/components/ui/use-confirm';
import { getErrorMessage } from '@/lib/api-error';
import { usePermission } from '@/lib/auth/use-permission';
import { useModifierGroupList } from '@/lib/menu/use-modifier-groups';
import { formatMoney } from '@/lib/money';
import { PERMISSIONS } from '@/lib/permissions';
import { toast } from '@/stores/toast';

type RequiredChoice = 'inherit' | 'required' | 'optional';

/**
 * Dish editor — attach reusable library modifier groups and tune per-dish
 * overrides. There is no inline modifier creation: groups always come from the
 * library (a quick "create" makes a real library group, then attaches it).
 */
export function ModifierGroupsEditor({
  itemId,
  groups,
  currency,
  onChanged,
}: {
  itemId: string;
  groups: AttachedModifierGroupResponse[];
  currency: string;
  onChanged: () => void | Promise<void>;
}) {
  const t = useTranslations('menu');
  const tc = useTranslations('common');
  const canManage = usePermission(PERMISSIONS.MENU_MANAGE);
  const { ask, dialog } = useConfirm();

  const attached = useMemo(
    () => [...groups].sort((a, b) => a.sortOrder - b.sortOrder),
    [groups],
  );
  const attachedIds = useMemo(() => new Set(attached.map((g) => g.id)), [attached]);

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const attach = useItemsControllerAttachModifierGroup();
  const detach = useItemsControllerDetachModifierGroup();
  const reorder = useItemsControllerReorderModifierGroups();

  // Library search for the attach picker (active groups only).
  const { groups: libraryGroups, isFetching: searching } = useModifierGroupList({
    page: 1,
    limit: 10,
    q: search.trim() || undefined,
    status: 'ACTIVE',
  });
  const candidates = libraryGroups.filter((g) => !attachedIds.has(g.id));

  const nextSortOrder =
    attached.length > 0 ? Math.max(...attached.map((g) => g.sortOrder)) + 1 : 0;

  const doAttach = async (group: ModifierGroupResponse) => {
    try {
      await attach.mutateAsync({
        itemId,
        data: { groupId: group.id, sortOrder: nextSortOrder },
      });
      toast.success(t('toast.groupAttached'));
      setSearch('');
      await onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const doDetach = async (group: AttachedModifierGroupResponse) => {
    const ok = await ask({
      title: tc('confirm'),
      message: t('confirmDetach'),
      confirmLabel: t('detach'),
      cancelLabel: tc('cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await detach.mutateAsync({ itemId, groupId: group.id });
      toast.success(t('toast.groupDetached'));
      await onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= attached.length) return;
    const ids = attached.map((g) => g.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    try {
      await reorder.mutateAsync({ itemId, data: { groupIds: ids } });
      toast.success(t('reorderSaved'));
      await onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{t('attachedGroups')}</h3>
      </div>

      {/* Attach control */}
      <Can permission={PERMISSIONS.MENU_MANAGE}>
        <div className="space-y-2 rounded-lg border border-gray-200 p-3">
          <div className="flex items-center gap-2">
            <input
              className={inputClass}
              placeholder={t('selectGroupToAttach')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button size="sm" variant="secondary" onClick={() => setCreateOpen(true)}>
              + {t('quickCreateAttach')}
            </Button>
          </div>
          {search.trim() !== '' && (
            <ul className="max-h-48 divide-y divide-gray-100 overflow-auto rounded-md border border-gray-100">
              {searching && candidates.length === 0 ? (
                <li className="px-3 py-2 text-sm text-gray-400">{tc('loading')}</li>
              ) : candidates.length === 0 ? (
                <li className="px-3 py-2 text-sm text-gray-400">{t('noLibraryMatches')}</li>
              ) : (
                candidates.map((g) => (
                  <li
                    key={g.id}
                    className="flex items-center justify-between gap-2 px-3 py-2"
                  >
                    <span className="text-sm text-gray-800">
                      {g.name}{' '}
                      <span className="text-xs text-gray-400">
                        (
                        {g.selectionType === ModifierGroupResponseSelectionType.SINGLE
                          ? t('single')
                          : t('multiple')}
                        )
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={attach.isPending}
                      onClick={() => doAttach(g)}
                    >
                      {t('attachGroup')}
                    </Button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </Can>

      {attached.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
          {t('noAttachedGroups')}
        </p>
      ) : (
        <ul className="space-y-3">
          {attached.map((group, index) => (
            <li key={group.id} className="rounded-lg border border-gray-200">
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">{group.name}</span>
                  <Badge tone="blue">
                    {group.effective.selectionType === ModifierGroupResponseSelectionType.SINGLE
                      ? t('single')
                      : t('multiple')}
                  </Badge>
                  {group.effective.required && <Badge tone="amber">{t('required')}</Badge>}
                </div>
                <Can permission={PERMISSIONS.MENU_MANAGE}>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t('moveUp')}
                      disabled={index === 0 || reorder.isPending}
                      onClick={() => move(index, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t('moveDown')}
                      disabled={index === attached.length - 1 || reorder.isPending}
                      onClick={() => move(index, 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setEditingId((id) => (id === group.id ? null : group.id))
                      }
                    >
                      {t('overrides')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => doDetach(group)}>
                      {t('detach')}
                    </Button>
                  </div>
                </Can>
              </div>

              {/* Options preview (read-only; managed in the library) */}
              <div className="px-3 py-2">
                <EffectiveLine group={group} t={t} />
                {group.options.length > 0 && (
                  <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                    {[...group.options]
                      .filter((o) => o.status === ModifierOptionResponseStatus.ACTIVE)
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((o) => (
                        <li key={o.id} className="tabular-nums">
                          {o.name} {o.priceDeltaAmount >= 0 ? '+' : ''}
                          {formatMoney(o.priceDeltaAmount, currency)}
                          {o.isDefault ? ` · ${t('defaultOption')}` : ''}
                        </li>
                      ))}
                  </ul>
                )}
              </div>

              {canManage && editingId === group.id && (
                <OverrideEditor
                  group={group}
                  itemId={itemId}
                  onClose={() => setEditingId(null)}
                  onChanged={onChanged}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {createOpen && (
        <ModifierGroupFormModal
          open
          onClose={() => setCreateOpen(false)}
          onSaved={async (saved) => {
            await doAttach(saved);
          }}
        />
      )}
      {dialog}
    </div>
  );
}

/** Shows the resolved (effective) rule for an attachment, noting overrides. */
function EffectiveLine({
  group,
  t,
}: {
  group: AttachedModifierGroupResponse;
  t: (k: string) => string;
}) {
  const a = group.attachment;
  const overridden =
    a.requiredOverride != null || a.minOverride != null || a.maxOverride != null;
  const min = group.effective.minSelect;
  const max = group.effective.maxSelect != null ? String(group.effective.maxSelect) : '∞';
  const rule =
    group.effective.selectionType === ModifierGroupResponseSelectionType.SINGLE
      ? group.effective.required
        ? t('exactlyOne')
        : t('upToOne')
      : `${min}–${max}`;
  return (
    <p className="text-xs text-gray-600">
      <span className="font-medium">{t('effective')}:</span> {rule}
      {group.effective.required ? ` · ${t('required')}` : ''}
      {overridden && (
        <span className="ml-1 rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">
          {t('overridden')}
        </span>
      )}
    </p>
  );
}

/** Inline per-attachment override form (blank input = inherit group value). */
function OverrideEditor({
  group,
  itemId,
  onClose,
  onChanged,
}: {
  group: AttachedModifierGroupResponse;
  itemId: string;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const t = useTranslations('menu');
  const tc = useTranslations('common');
  const setOverrides = useItemsControllerSetModifierGroupOverrides();

  const a = group.attachment;
  const isMultiple =
    group.selectionType === ModifierGroupResponseSelectionType.MULTIPLE;

  const initialRequired: RequiredChoice =
    a.requiredOverride == null ? 'inherit' : a.requiredOverride ? 'required' : 'optional';

  const [requiredChoice, setRequiredChoice] = useState<RequiredChoice>(initialRequired);
  const [min, setMin] = useState(a.minOverride != null ? String(a.minOverride) : '');
  const [max, setMax] = useState(a.maxOverride != null ? String(a.maxOverride) : '');
  const [error, setError] = useState<string>();

  const inheritedRequired = group.required ? t('required') : t('optionalLabel');
  const inheritedMin = group.minSelect ?? 0;
  const inheritedMax = group.maxSelect != null ? String(group.maxSelect) : '∞';

  const save = async () => {
    const minVal = min === '' ? null : Number(min);
    const maxVal = max === '' ? null : Number(max);
    const requiredVal: boolean | null =
      requiredChoice === 'inherit' ? null : requiredChoice === 'required';

    if (isMultiple) {
      if (minVal != null && minVal < 0) {
        setError(t('validation.minNonNegative'));
        return;
      }
      if (maxVal != null && maxVal < 1) {
        setError(t('validation.maxAtLeastOne'));
        return;
      }
      if (minVal != null && maxVal != null && minVal > maxVal) {
        setError(t('validation.minMax'));
        return;
      }
      if (requiredVal === true && (minVal ?? inheritedMin) < 1) {
        setError(t('validation.requiredMin'));
        return;
      }
    }
    setError(undefined);

    try {
      await setOverrides.mutateAsync({
        itemId,
        groupId: group.id,
        data: {
          requiredOverride: requiredVal,
          minOverride: isMultiple ? minVal : null,
          maxOverride: isMultiple ? maxVal : null,
          sortOrder: group.sortOrder,
        },
      });
      toast.success(t('toast.overridesSaved'));
      await onChanged();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-3 border-t border-gray-100 bg-gray-50 px-3 py-3">
      <p className="text-xs text-gray-500">{t('overridesHint')}</p>
      <Field label={t('requiredOverride')}>
        <select
          className={inputClass}
          value={requiredChoice}
          onChange={(e) => setRequiredChoice(e.target.value as RequiredChoice)}
        >
          <option value="inherit">
            {t('inherit')} ({inheritedRequired})
          </option>
          <option value="required">{t('required')}</option>
          <option value="optional">{t('optionalLabel')}</option>
        </select>
      </Field>
      {isMultiple && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('minOverride')}>
            <input
              type="number"
              min={0}
              className={inputClass}
              placeholder={`${t('inherit')} (${inheritedMin})`}
              value={min}
              onChange={(e) => setMin(e.target.value)}
            />
          </Field>
          <Field label={t('maxOverride')}>
            <input
              type="number"
              min={1}
              className={inputClass}
              placeholder={`${t('inherit')} (${inheritedMax})`}
              value={max}
              onChange={(e) => setMax(e.target.value)}
            />
          </Field>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onClose} disabled={setOverrides.isPending}>
          {tc('cancel')}
        </Button>
        <Button size="sm" variant="primary" onClick={save} disabled={setOverrides.isPending}>
          {tc('save')}
        </Button>
      </div>
    </div>
  );
}
