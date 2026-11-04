"use client";

import { useMemo, useState } from "react";
import { usePlatformCatalogItemsControllerList } from "@/api/generated/endpoints/platform-catalog-items/platform-catalog-items";
import { usePlatformCatalogTaxonomyControllerGet } from "@/api/generated/endpoints/platform-catalog-taxonomy/platform-catalog-taxonomy";
import type { CatalogItemResponse } from "@/api/generated/model/catalogItemResponse";
import { Pagination } from "@/components/ui/pagination";
import { toList } from "@/lib/format";
import { PageHeader } from "@/components/layout/app-shell";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Select,
  Spinner,
  StatusBadge,
} from "@/components/ui/primitives";
import { getErrorMessage } from "@/lib/errors";
import { STRINGS } from "@/components/platform-catalog/strings";
import { CatalogImportPanel } from "@/components/platform-catalog/catalog-import-panel";

const PAGE_SIZE = 50;

/** CATALOG-UNIT-1 (field newer than the generated client). */
const UNIT_LABEL: Record<string, string> = { GRAM: "g", MILLILITER: "ml", PIECE: "pcs" };

export function CatalogManager() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState(false);

  const q = search.trim();
  // The API returns a PAGED list ({ items, pagination } after the client unwraps
  // the envelope) — not a bare array — so read it through toList().
  const { data, isLoading, isError, error, refetch } = usePlatformCatalogItemsControllerList({
    page,
    limit: PAGE_SIZE,
    ...(q ? { q } : {}),
    ...(categoryId ? { categoryId } : {}),
  });
  const list = useMemo(() => toList<CatalogItemResponse>(data), [data]);
  const items = list.items;

  const taxonomy = usePlatformCatalogTaxonomyControllerGet();
  const categories = useMemo(
    () => [...(taxonomy.data?.categories ?? [])].sort((a, b) => a.position - b.position),
    [taxonomy.data],
  );
  const categoryLabel = useMemo(
    () => new Map(categories.map((c) => [c.id, c.labelEn] as const)),
    [categories],
  );
  const filtered = Boolean(q || categoryId);

  return (
    <div>
      <PageHeader
        title={STRINGS.title}
        description={STRINGS.description}
        action={<Button onClick={() => setImporting(true)}>{STRINGS.importCsv}</Button>}
      />

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="w-full max-w-sm">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={STRINGS.searchPlaceholder}
          />
        </div>
        <div className="w-full max-w-xs">
          <Select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.labelEn} · {c.labelRu} · {c.labelHy}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-gray-500">
            <Spinner className="h-4 w-4" /> Loading…
          </div>
        </Card>
      ) : isError ? (
        <Card>
          <ErrorState message={getErrorMessage(error, STRINGS.loadError)} onRetry={() => refetch()} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            title={filtered ? STRINGS.emptyFilteredTitle : STRINGS.emptyTitle}
            description={filtered ? STRINGS.emptyFilteredDescription : STRINGS.emptyDescription}
            action={
              filtered ? undefined : <Button onClick={() => setImporting(true)}>{STRINGS.importCsv}</Button>
            }
          />
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 text-left text-xs font-medium text-gray-500">
                <tr>
                  <th className="px-4 py-2">{STRINGS.colSlug}</th>
                  <th className="px-4 py-2">{STRINGS.colName}</th>
                  <th className="px-4 py-2">{STRINGS.colCategory}</th>
                  <th className="px-4 py-2">{STRINGS.colUnit}</th>
                  <th className="px-4 py-2">{STRINGS.colStatus}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 font-mono text-xs text-gray-700">{item.slug}</td>
                    <td className="px-4 py-2">
                      <div className="text-gray-900">{item.nameEn}</div>
                      <div className="text-xs text-gray-400">
                        {item.nameRu} · {item.nameHy}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{item.categoryId
                        ? (categoryLabel.get(String(item.categoryId)) ?? String(item.categoryId))
                        : "—"}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {UNIT_LABEL[(item as { baseUnit?: string }).baseUnit ?? ""] ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            itemCount={items.length}
            meta={list.pagination}
            onPageChange={setPage}
          />
        </Card>
      )}

      <CatalogImportPanel open={importing} onClose={() => setImporting(false)} />
    </div>
  );
}
