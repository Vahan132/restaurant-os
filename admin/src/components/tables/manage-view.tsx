'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import {
  useFloorsControllerRemove,
  useFloorsControllerReorderFloors,
  useFloorsControllerStatus,
} from '@/api/generated/floors/floors';
import { useTablesControllerRemove } from '@/api/generated/tables/tables';
import {
  FloorResponseStatus,
  type FloorResponse,
  type TableResponse,
} from '@/api/generated/model';
import { Can } from '@/components/auth/can';
import { FloorFormModal } from '@/components/tables/floor-form-modal';
import { TableFormModal } from '@/components/tables/table-form-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/use-confirm';
import { getErrorMessage } from '@/lib/api-error';
import { PERMISSIONS } from '@/lib/permissions';
import { STATUS_STYLE } from '@/lib/tables/status-style';
import type { TableStatus } from '@/lib/tables/transitions';
import { useFloors, useTables, useTablesInvalidation } from '@/lib/tables/use-tables-data';
import { toast } from '@/stores/toast';

function FloorsPanel({
  selectedId,
  onSelect,
  floors,
  isLoading,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  floors: FloorResponse[];
  isLoading: boolean;
}) {
  const t = useTranslations('tables');
  const tc = useTranslations('common');
  const invalidate = useTablesInvalidation();
  const { ask, dialog } = useConfirm();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FloorResponse | null>(null);

  const reorder = useFloorsControllerReorderFloors();
  const setStatus = useFloorsControllerStatus();
  const remove = useFloorsControllerRemove();

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= floors.length) return;
    const next = [...floors];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    try {
      await reorder.mutateAsync({
        data: { order: next.map((f, idx) => ({ id: f.id, displayOrder: idx })) },
      });
      await invalidate();
      toast.success(t('reorderSaved'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const toggleStatus = async (f: FloorResponse) => {
    const status =
      f.status === FloorResponseStatus.ACTIVE
        ? FloorResponseStatus.INACTIVE
        : FloorResponseStatus.ACTIVE;
    try {
      await setStatus.mutateAsync({ id: f.id, data: { status } });
      await invalidate();
      toast.success(t('toast.statusUpdated'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const onDelete = async (f: FloorResponse) => {
    const ok = await ask({
      title: tc('confirm'),
      message: t('confirmDeleteFloor'),
      confirmLabel: tc('delete'),
      cancelLabel: tc('cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: f.id });
      await invalidate();
      toast.success(t('toast.floorDeleted'));
    } catch (err) {
      toast.error(getErrorMessage(err, t('floorHasTables')));
    }
  };

  const nextDisplayOrder =
    floors.length > 0 ? Math.max(...floors.map((f) => f.displayOrder)) + 1 : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">{t('floors')}</h2>
        <Can permission={PERMISSIONS.TABLE_MANAGE}>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            + {t('addFloor')}
          </Button>
        </Can>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <ul className="space-y-2 p-2">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-9 animate-pulse rounded-md bg-gray-100" />
            ))}
          </ul>
        ) : floors.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">{t('noFloors')}</p>
        ) : (
          <ul className="space-y-1">
            {floors.map((f, index) => {
              const inactive = f.status === FloorResponseStatus.INACTIVE;
              const active = f.id === selectedId;
              return (
                <li
                  key={f.id}
                  className={`group rounded-md border px-2 py-1.5 ${
                    active ? 'border-brand bg-brand/5' : 'border-transparent hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelect(f.id)}
                      className={`flex-1 truncate text-left text-sm ${
                        inactive ? 'text-gray-400' : 'text-gray-800'
                      }`}
                    >
                      {f.name}
                    </button>
                    {inactive && <Badge tone="gray">{t('inactive')}</Badge>}
                  </div>
                  <Can permission={PERMISSIONS.TABLE_MANAGE}>
                    <div className="mt-1 flex flex-wrap items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => move(index, -1)}
                        disabled={index === 0 || reorder.isPending}
                        aria-label={t('moveUp')}
                      >
                        ↑
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => move(index, 1)}
                        disabled={index === floors.length - 1 || reorder.isPending}
                        aria-label={t('moveDown')}
                      >
                        ↓
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(f);
                          setFormOpen(true);
                        }}
                      >
                        {tc('edit')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleStatus(f)}>
                        {inactive ? t('activate') : t('deactivate')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onDelete(f)}>
                        {tc('delete')}
                      </Button>
                    </div>
                  </Can>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {formOpen && (
        <FloorFormModal
          open={formOpen}
          floor={editing}
          nextDisplayOrder={nextDisplayOrder}
          onClose={() => setFormOpen(false)}
        />
      )}
      {dialog}
    </div>
  );
}

function TablesPanel({ floorId, floors }: { floorId: string; floors: FloorResponse[] }) {
  const t = useTranslations('tables');
  const tc = useTranslations('common');
  const invalidate = useTablesInvalidation();
  const { ask, dialog } = useConfirm();
  const { tables, isLoading } = useTables(floorId);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TableResponse | null>(null);
  const remove = useTablesControllerRemove();

  const onDelete = async (table: TableResponse) => {
    const ok = await ask({
      title: tc('confirm'),
      message: t('confirmDeleteTable'),
      confirmLabel: tc('delete'),
      cancelLabel: tc('cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: table.id });
      await invalidate();
      toast.success(t('toast.tableDeleted'));
    } catch (err) {
      toast.error(getErrorMessage(err, t('tableInUse')));
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">{t('tables')}</h2>
        <Can permission={PERMISSIONS.TABLE_MANAGE}>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            + {t('addTable')}
          </Button>
        </Can>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : tables.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('noTables')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3 font-medium">{t('tableName')}</th>
                <th className="py-2 pr-3 font-medium">{t('seatCapacity')}</th>
                <th className="py-2 pr-3 font-medium">{t('status')}</th>
                <th className="py-2 pr-3 font-medium">{t('qrIdentifier')}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {tables.map((table) => (
                <tr key={table.id} className="border-b border-gray-100">
                  <td className="py-2 pr-3 font-medium text-gray-800">{table.name}</td>
                  <td className="py-2 pr-3 text-gray-700">{table.seatCapacity}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs ${STATUS_STYLE[table.status as TableStatus].text}`}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-sm ${STATUS_STYLE[table.status as TableStatus].swatch}`}
                      />
                      {t(`status.${table.status}`)}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-gray-500">{table.qrIdentifier ?? '—'}</td>
                  <td className="py-2">
                    <Can permission={PERMISSIONS.TABLE_MANAGE}>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditing(table);
                            setFormOpen(true);
                          }}
                        >
                          {tc('edit')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onDelete(table)}>
                          {tc('delete')}
                        </Button>
                      </div>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {formOpen && (
        <TableFormModal
          open={formOpen}
          table={editing}
          floors={floors}
          defaultFloorId={floorId}
          onClose={() => setFormOpen(false)}
        />
      )}
      {dialog}
    </div>
  );
}

export function ManageView() {
  const t = useTranslations('tables');
  const { floors, isLoading } = useFloors(true);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFloorId && floors.length > 0) {
      setSelectedFloorId(floors[0]!.id);
    }
  }, [floors, selectedFloorId]);

  return (
    <div className="flex h-[calc(100vh-12rem)] overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="w-72 shrink-0 border-r border-gray-200">
        <FloorsPanel
          selectedId={selectedFloorId}
          onSelect={setSelectedFloorId}
          floors={floors}
          isLoading={isLoading}
        />
      </div>
      <div className="min-w-0 flex-1">
        {selectedFloorId ? (
          <TablesPanel floorId={selectedFloorId} floors={floors} />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-sm text-gray-500">
            {t('selectFloor')}
          </div>
        )}
      </div>
    </div>
  );
}
