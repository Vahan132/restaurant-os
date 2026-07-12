"use client";

import { useState } from "react";
import { usePlatformCatalogItemsControllerList } from "@/api/generated/endpoints/platform-catalog-items/platform-catalog-items";
import { PageHeader } from "@/components/layout/app-shell";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Spinner,
  StatusBadge,
} from "@/components/ui/primitives";
import { getErrorMessage } from "@/lib/errors";
import { STRINGS } from "@/components/platform-catalog/strings";
import { CatalogImportPanel } from "@/components/platform-catalog/catalog-import-panel";

export function CatalogManager() {
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);

  const q = search.trim();
  const { data, isLoading, isError, error, refetch } = usePlatformCatalogItemsControllerList(
    q ? { q } : undefined,
  );
  const items = Array.isArray(data) ? data : [];

  return (
    <div>
      <PageHeader
        title={STRINGS.title}
        description={STRINGS.description}
        action={<Button onClick={() => setImporting(true)}>{STRINGS.importCsv}</Button>}
      />

      <div className="mb-3 max-w-sm">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={STRINGS.searchPlaceholder}
        />
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
            title={q ? STRINGS.emptyFilteredTitle : STRINGS.emptyTitle}
            description={q ? STRINGS.emptyFilteredDescription : STRINGS.emptyDescription}
            action={
              q ? undefined : <Button onClick={() => setImporting(true)}>{STRINGS.importCsv}</Button>
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
                  <th className="px-4 py-2">{STRINGS.colAdg}</th>
                  <th className="px-4 py-2">{STRINGS.colAllergens}</th>
                  <th className="px-4 py-2">{STRINGS.colReviewed}</th>
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
                    <td className="px-4 py-2 text-gray-600">{item.categoryId ? String(item.categoryId) : "—"}</td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-600">
                      {item.adgCode ? String(item.adgCode) : "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600">
                      {item.allergenSlugs.length > 0 ? item.allergenSlugs.join(", ") : "—"}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {item.allergensReviewed ? (
                        <span className="text-green-700">{STRINGS.reviewedYes}</span>
                      ) : (
                        <span className="text-gray-400">{STRINGS.reviewedNo}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <CatalogImportPanel open={importing} onClose={() => setImporting(false)} />
    </div>
  );
}
