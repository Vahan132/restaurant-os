'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { CatalogItemResponseStatus } from '@/api/generated/model';
import { Pagination } from '@/components/inventory/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/form';
import { useConfirm } from '@/components/ui/use-confirm';
import { getErrorMessage } from '@/lib/api-error';
import {
  taxonomyLabel,
  useCatalogArchive,
  useCatalogInvalidation,
  useCatalogList,
  useCatalogTaxonomy,
  type CatalogItemVM,
} from '@/lib/platform-catalog/use-catalog';
import { toast } from '@/stores/toast';

import { CatalogItemForm } from './catalog-item-form';

const PAGE_SIZE = 20;

export function CatalogManager() {
  const t = useTranslations('platformCatalog');
  const tc = useTranslations('common');
  const locale = useLocale();

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [reviewed, setReviewed] = useState<'all' | 'reviewed' | 'unreviewed'>('all');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<CatalogItemVM | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(() => {
    setPage(1);
  }, [debounced, status, reviewed, categoryId]);

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      q: debounced || undefined,
      categoryId: categoryId || undefined,
      includeArchived: status === 'archived' ? true : undefined,
      reviewed: reviewed === 'all' ? undefined : reviewed,
    }),
    [page, debounced, categoryId, status, reviewed],
  );

  const { items, pagination, isLoading, isError, isFetching } = useCatalogList(params);
  const taxonomy = useCatalogTaxonomy();
  const categories = useMemo(
    () => [...(taxonomy.data?.categories ?? [])].sort((a, b) => a.position - b.position),
    [taxonomy.data],
  );
  const invalidate = useCatalogInvalidation();
  const archiveMut = useCatalogArchive();
  const { ask, dialog } = useConfirm();

  // includeArchived returns active + archived; the "archived" view shows archived only.
  const rows =
    status === 'archived'
      ? items.filter((i) => i.status === CatalogItemResponseStatus.ARCHIVED)
      : items;

  const categoryName = (id: string | null) => {
    if (!id) return '—';
    const c = categories.find((x) => x.id === id);
    return c ? taxonomyLabel(c, locale) : id;
  };

  const onArchive = async (item: CatalogItemVM) => {
    const ok = await ask({
      title: t('archiveTitle'),
      message: t('archiveMessage', { name: item.nameEn }),
      confirmLabel: t('archive'),
      cancelLabel: tc('cancel'),
    });
    if (!ok) return;
    try {
      await archiveMut.mutateAsync({ id: item.id });
      await invalidate();
      toast.success(t('archived'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const hasNext = (pagination?.totalPages ?? 1) > page;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{t('title')}</h1>
        <Button variant="primary" onClick={() => setCreating(true)}>
          {t('newItem')}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          className={`${inputClass} max-w-xs`}
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={`${inputClass} w-auto`}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-label={t('category')}
        >
          <option value="">{t('allCategories')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {taxonomyLabel(c, locale)}
            </option>
          ))}
        </select>
        <select
          className={`${inputClass} w-auto`}
          value={status}
          onChange={(e) => setStatus(e.target.value as 'active' | 'archived')}
          aria-label={t('filterStatus')}
        >
          <option value="active">{t('active')}</option>
          <option value="archived">{t('archived')}</option>
        </select>
        <select
          className={`${inputClass} w-auto`}
          value={reviewed}
          onChange={(e) => setReviewed(e.target.value as 'all' | 'reviewed' | 'unreviewed')}
          aria-label={t('filterReviewed')}
        >
          <option value="all">{t('reviewedAll')}</option>
          <option value="unreviewed">{t('reviewedPending')}</option>
          <option value="reviewed">{t('reviewedDone')}</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-red-600">{tc('error')}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500">{t('empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">{t('name')}</th>
                <th className="px-4 py-2">{t('category')}</th>
                <th className="px-4 py-2">{t('allergens')}</th>
                <th className="px-4 py-2">{t('adgCode')}</th>
                <th className="px-4 py-2">{t('status')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <button
                      className="text-left font-medium text-brand hover:underline"
                      onClick={() => setEditing(item)}
                    >
                      {item.nameEn}
                    </button>
                    <div className="text-xs text-gray-400">{item.slug}</div>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{categoryName(item.categoryId)}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {item.allergenSlugs.length === 0 ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        item.allergenSlugs.map((s) => (
                          <Badge key={s} tone="amber">
                            {s}
                          </Badge>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{item.adgCode ?? '—'}</td>
                  <td className="px-4 py-2">
                    {item.status === CatalogItemResponseStatus.ACTIVE ? (
                      <Badge tone="green">{t('active')}</Badge>
                    ) : (
                      <Badge tone="gray">{t('archived')}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(item)}>
                        {tc('edit')}
                      </Button>
                      {item.status === CatalogItemResponseStatus.ACTIVE && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => onArchive(item)}
                          disabled={archiveMut.isPending}
                        >
                          {t('archive')}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
        hasNext={hasNext}
        isFetching={isFetching}
      />

      {(creating || editing) && (
        <CatalogItemForm
          item={editing}
          taxonomy={taxonomy.data}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            await invalidate();
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
      {dialog}
    </div>
  );
}
