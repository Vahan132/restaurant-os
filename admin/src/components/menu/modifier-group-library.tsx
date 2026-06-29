'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { useModifierGroupsControllerUpdate } from '@/api/generated/menu-modifier-groups/menu-modifier-groups';
import {
  ModifierGroupResponseSelectionType,
  ModifierGroupResponseStatus,
  type ModifierGroupResponse,
  type ModifierGroupsControllerListParams,
} from '@/api/generated/model';
import { Can } from '@/components/auth/can';
import { ModifierGroupFormModal } from '@/components/menu/modifier-group-form-modal';
import { ModifierGroupOptionsEditor } from '@/components/menu/modifier-group-options-editor';
import { Pagination } from '@/components/inventory/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { inputClass } from '@/components/ui/form';
import { useConfirm } from '@/components/ui/use-confirm';
import { getErrorMessage } from '@/lib/api-error';
import { usePermission } from '@/lib/auth/use-permission';
import {
  useModifierGroupList,
  useModifierGroupsInvalidation,
} from '@/lib/menu/use-modifier-groups';
import { PERMISSIONS } from '@/lib/permissions';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';
import { toast } from '@/stores/toast';

const PAGE_SIZE = 20;

/** Summarize a group's selection rule for the list, e.g. "Multiple · 1–3". */
function ruleLabel(group: ModifierGroupResponse, t: (k: string) => string): string {
  if (group.selectionType === ModifierGroupResponseSelectionType.SINGLE) {
    return t('single');
  }
  const min = group.minSelect ?? 0;
  const max = group.maxSelect != null ? String(group.maxSelect) : '∞';
  return `${t('multiple')} · ${min}–${max}`;
}

export function ModifierGroupLibrary() {
  const t = useTranslations('menu');
  const tc = useTranslations('common');
  const canManage = usePermission(PERMISSIONS.MENU_MANAGE);
  const { ask, dialog } = useConfirm();
  const { invalidateGroups } = useModifierGroupsInvalidation();

  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [formGroup, setFormGroup] = useState<{ group: ModifierGroupResponse | null } | null>(null);
  const [optionsGroup, setOptionsGroup] = useState<ModifierGroupResponse | null>(null);

  const params = useMemo<ModifierGroupsControllerListParams>(
    () => ({
      page,
      limit: PAGE_SIZE,
      q: search.trim() || undefined,
      // Active-only by default; including archived means no status filter.
      status: showArchived ? undefined : ModifierGroupResponseStatus.ACTIVE,
    }),
    [page, search, showArchived],
  );
  const { groups, pagination, isLoading, isFetching, isError } = useModifierGroupList(params);
  const hasNext = pagination?.hasNext ?? groups.length === PAGE_SIZE;

  const update = useModifierGroupsControllerUpdate();

  const toggleArchive = async (group: ModifierGroupResponse) => {
    const archiving = group.status === ModifierGroupResponseStatus.ACTIVE;
    const ok = await ask({
      title: tc('confirm'),
      message: archiving ? t('confirmArchiveGroup') : t('confirmRestoreGroup'),
      confirmLabel: archiving ? t('archiveGroup') : t('restoreGroup'),
      cancelLabel: tc('cancel'),
      danger: archiving,
    });
    if (!ok) return;
    try {
      await update.mutateAsync({
        id: group.id,
        data: {
          status: archiving
            ? ModifierGroupResponseStatus.INACTIVE
            : ModifierGroupResponseStatus.ACTIVE,
        },
      });
      toast.success(archiving ? t('toast.groupArchived') : t('toast.groupRestored'));
      await invalidateGroups();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const onSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('modifierLibrary')}</h1>
          <p className="text-sm text-gray-500">{t('modifierLibraryDesc')}</p>
        </div>
        <Can permission={PERMISSIONS.MENU_MANAGE}>
          <Button variant="primary" onClick={() => setFormGroup({ group: null })}>
            + {t('newGroup')}
          </Button>
        </Can>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className={`${inputClass} max-w-xs`}
          placeholder={t('searchGroups')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => {
              setShowArchived(e.target.checked);
              setPage(1);
            }}
          />
          {t('showArchived')}
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : isError ? (
          <p className="py-10 text-center text-sm text-gray-500">{tc('error')}</p>
        ) : groups.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('noGroupsLibrary')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('groupName')}</th>
                <th className="px-4 py-2 font-medium">{t('selectionType')}</th>
                <th className="px-4 py-2 font-medium">{t('required')}</th>
                <th className="px-4 py-2 font-medium">{t('status')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const archived = group.status === ModifierGroupResponseStatus.INACTIVE;
                return (
                  <tr key={group.id} className="border-b border-gray-100">
                    <td className="px-4 py-2 font-medium text-gray-800">{group.name}</td>
                    <td className="px-4 py-2 text-gray-600">{ruleLabel(group, t)}</td>
                    <td className="px-4 py-2">
                      {group.required ? (
                        <Badge tone="amber">{t('required')}</Badge>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {archived ? (
                        <Badge tone="gray">{t('archived')}</Badge>
                      ) : (
                        <Badge tone="green">{t('active')}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setOptionsGroup(group)}
                        >
                          {t('manageOptions')}
                        </Button>
                        <Can permission={PERMISSIONS.MENU_MANAGE}>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setFormGroup({ group })}
                          >
                            {tc('edit')}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleArchive(group)}
                          >
                            {archived ? t('restoreGroup') : t('archiveGroup')}
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

      <Pagination
        page={page}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
        hasNext={hasNext}
        isFetching={isFetching}
      />

      {formGroup && (
        <ModifierGroupFormModal
          open
          group={formGroup.group}
          onClose={() => setFormGroup(null)}
          onSaved={() => invalidateGroups()}
        />
      )}

      {optionsGroup && (
        <Drawer open title={optionsGroup.name} onClose={() => setOptionsGroup(null)}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="blue">
                {optionsGroup.selectionType === ModifierGroupResponseSelectionType.SINGLE
                  ? t('single')
                  : t('multiple')}
              </Badge>
              {optionsGroup.required && <Badge tone="amber">{t('required')}</Badge>}
              {optionsGroup.status === ModifierGroupResponseStatus.INACTIVE && (
                <Badge tone="gray">{t('archived')}</Badge>
              )}
            </div>
            <ModifierGroupOptionsEditor groupId={optionsGroup.id} currency={currency} />
          </div>
        </Drawer>
      )}
      {dialog}
    </div>
  );
}
