'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import type { TableResponse } from '@/api/generated/model';
import { StatusLegend } from '@/components/tables/status-legend';
import { TableStatusMenu } from '@/components/tables/table-status-menu';
import { Button } from '@/components/ui/button';
import { useFloorPlanLive } from '@/lib/realtime/use-floor-plan-live';
import { PERMISSIONS } from '@/lib/permissions';
import { usePermission } from '@/lib/auth/use-permission';
import { STATUS_STYLE } from '@/lib/tables/status-style';
import type { TableStatus } from '@/lib/tables/transitions';
import {
  useFloors,
  useRestaurantSettings,
  useTables,
  useTablesInvalidation,
} from '@/lib/tables/use-tables-data';

function TableTile({
  table,
  allowManual,
  canStatus,
  onChanged,
}: {
  table: TableResponse;
  allowManual: boolean;
  canStatus: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const t = useTranslations('tables');
  const style = STATUS_STYLE[table.status as TableStatus];
  return (
    <div className={`flex flex-col gap-2 rounded-lg border p-3 ${style.tile}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`truncate font-semibold ${style.text}`}>{table.name}</p>
          <p className="text-xs text-gray-600">
            {table.seatCapacity} {t('seats')}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-medium ${style.text}`}>
          {t(`status.${table.status}`)}
        </span>
      </div>
      {canStatus && (
        <div className="flex justify-end">
          <TableStatusMenu table={table} allowManual={allowManual} onChanged={onChanged} />
        </div>
      )}
    </div>
  );
}

export function FloorPlanView() {
  const t = useTranslations('tables');
  const canStatus = usePermission(PERMISSIONS.TABLE_STATUS_UPDATE);

  const { floors, isLoading: floorsLoading } = useFloors(false);
  const { tables, isLoading: tablesLoading } = useTables();
  const { settings } = useRestaurantSettings();
  const invalidate = useTablesInvalidation();

  // Subscribe to live table.status_changed events.
  useFloorPlanLive();

  const allowManual = settings?.allowManualTableStatus ?? false;
  const isLoading = floorsLoading || tablesLoading;

  const tablesByFloor = useMemo(() => {
    const map = new Map<string, TableResponse[]>();
    for (const tbl of tables) {
      const list = map.get(tbl.floorId) ?? [];
      list.push(tbl);
      map.set(tbl.floorId, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [tables]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusLegend />
        <Button size="sm" variant="secondary" onClick={() => void invalidate()}>
          ↻ {t('refresh')}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : floors.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-500">{t('noFloors')}</p>
      ) : (
        <div className="space-y-6">
          {floors.map((floor) => {
            const floorTables = tablesByFloor.get(floor.id) ?? [];
            return (
              <section key={floor.id}>
                <h3 className="mb-2 text-sm font-semibold text-gray-900">{floor.name}</h3>
                {floorTables.length === 0 ? (
                  <p className="text-sm text-gray-500">{t('noTables')}</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {floorTables.map((table) => (
                      <TableTile
                        key={table.id}
                        table={table}
                        allowManual={allowManual}
                        canStatus={canStatus}
                        onChanged={invalidate}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
