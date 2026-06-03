'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { usePermissionsCatalog } from '@/lib/users/use-users-data';

export function PermissionMatrix({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const t = useTranslations('perm');
  const tr = useTranslations('roles');
  const { permissions: catalog, isLoading } = usePermissionsCatalog();

  const selected = new Set(value);
  // Show catalog keys; if a role holds a key not in the catalog, include it too.
  const keys = Array.from(new Set([...catalog, ...value]));

  const label = (key: string) => (t.has(`${key}.label`) ? t(`${key}.label`) : key);
  const desc = (key: string) => (t.has(`${key}.desc`) ? t(`${key}.desc`) : '');

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange([...next]);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{tr('permissions')}</span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => onChange([...keys])}>
            {tr('selectAll')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onChange([])}>
            {tr('clearAll')}
          </Button>
        </div>
      </div>
      <div className="grid max-h-72 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-gray-200 p-2 sm:grid-cols-2">
        {keys.map((key) => (
          <label
            key={key}
            className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-gray-50"
          >
            <input
              type="checkbox"
              className="mt-0.5"
              checked={selected.has(key)}
              onChange={() => toggle(key)}
            />
            <span className="min-w-0">
              <span className="block text-sm text-gray-800">{label(key)}</span>
              {desc(key) && <span className="block text-xs text-gray-500">{desc(key)}</span>}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
