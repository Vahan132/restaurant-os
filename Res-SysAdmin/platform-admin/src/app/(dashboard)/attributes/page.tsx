"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  usePlatformConsumerListingControllerListAttributes,
  usePlatformConsumerListingControllerDeleteCategoryRoute,
  usePlatformConsumerListingControllerDeleteValueRoute,
  getPlatformConsumerListingControllerListAttributesQueryKey,
} from "@/api/generated/endpoints/platform-consumer-listing/platform-consumer-listing";
import type { AttributeCategoryResponse, AttributeValueResponse } from "@/api/generated/model";
import { PageHeader } from "@/components/layout/app-shell";
import { Button, Card, EmptyState, ErrorState, Spinner } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { getErrorCode, getErrorMessage } from "@/lib/errors";
import { CategoryFormDialog } from "@/components/attributes/category-form-dialog";
import { ValueFormDialog } from "@/components/attributes/value-form-dialog";
import { STRINGS, ATTRIBUTE_VALUE_IN_USE } from "@/components/attributes/strings";

type DeleteTarget =
  | { kind: "category"; category: AttributeCategoryResponse }
  | { kind: "value"; value: AttributeValueResponse };

function byPosition<T extends { position: number }>(a: T, b: T): number {
  return a.position - b.position;
}

export default function AttributesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch } =
    usePlatformConsumerListingControllerListAttributes();
  const deleteCategory = usePlatformConsumerListingControllerDeleteCategoryRoute();
  const deleteValue = usePlatformConsumerListingControllerDeleteValueRoute();

  const categories = useMemo(
    () => (Array.isArray(data) ? [...data].sort(byPosition) : []),
    [data],
  );

  // Expansion: default everything open so values are visible.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  function toggleExpand(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Dialog state
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AttributeCategoryResponse | null>(null);
  const [creatingValueFor, setCreatingValueFor] = useState<AttributeCategoryResponse | null>(null);
  const [editingValue, setEditingValue] = useState<{
    categoryId: string;
    value: AttributeValueResponse;
  } | null>(null);
  const [toDelete, setToDelete] = useState<DeleteTarget | null>(null);

  function invalidate() {
    void queryClient.invalidateQueries({
      queryKey: getPlatformConsumerListingControllerListAttributesQueryKey(),
    });
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      if (toDelete.kind === "category") {
        await deleteCategory.mutateAsync({ id: toDelete.category.id });
        toast.success(STRINGS.categoryDeleted);
      } else {
        await deleteValue.mutateAsync({ id: toDelete.value.id });
        toast.success(STRINGS.valueDeleted);
      }
      invalidate();
      setToDelete(null);
    } catch (err) {
      // Guarded delete: surface the in-use case as a friendly blocked message.
      if (getErrorCode(err) === ATTRIBUTE_VALUE_IN_USE) {
        toast.error(
          STRINGS.inUseTitle,
          toDelete.kind === "category"
            ? STRINGS.inUseCategoryDesc
            : STRINGS.inUseValueDesc,
        );
      } else {
        toast.error(STRINGS.deleteFailed, getErrorMessage(err));
      }
      setToDelete(null);
    }
  }

  const deleting = deleteCategory.isPending || deleteValue.isPending;

  return (
    <div>
      <PageHeader
        title={STRINGS.title}
        description={STRINGS.description}
        action={<Button onClick={() => setCreatingCategory(true)}>{STRINGS.newCategory}</Button>}
      />

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
      ) : categories.length === 0 ? (
        <Card>
          <EmptyState
            title={STRINGS.emptyTitle}
            description={STRINGS.emptyDescription}
            action={<Button onClick={() => setCreatingCategory(true)}>{STRINGS.newCategory}</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => {
            const isOpen = !collapsed.has(cat.id);
            const values = [...cat.values].sort(byPosition);
            return (
              <Card key={cat.id}>
                {/* Category header row */}
                <div className="flex items-start justify-between gap-4 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleExpand(cat.id)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    aria-expanded={isOpen}
                  >
                    <span
                      className={
                        "mt-1 inline-block text-gray-400 transition-transform " +
                        (isOpen ? "rotate-90" : "")
                      }
                      aria-hidden
                    >
                      ▶
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{cat.labelEn}</span>
                        <span
                          className={
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
                            (cat.isFilterable
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-600")
                          }
                          title={STRINGS.filterableHelp}
                        >
                          {cat.isFilterable ? STRINGS.filterableBadge : STRINGS.displayOnlyBadge}
                        </span>
                        <span className="text-xs text-gray-400">
                          {STRINGS.valuesCount(values.length)}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {cat.labelRu} · {cat.labelHy}
                      </span>
                      <span className="mt-0.5 block font-mono text-xs text-gray-400">{cat.slug}</span>
                    </span>
                  </button>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCreatingValueFor(cat)}
                    >
                      {STRINGS.addValue}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setEditingCategory(cat)}>
                      {STRINGS.edit}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setToDelete({ kind: "category", category: cat })}
                    >
                      {STRINGS.delete}
                    </Button>
                  </div>
                </div>

                {/* Nested values */}
                {isOpen ? (
                  <div className="border-t border-gray-100 bg-gray-50/60">
                    {values.length === 0 ? (
                      <p className="px-12 py-3 text-sm text-gray-400">{STRINGS.noValues}</p>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {values.map((val) => (
                          <li
                            key={val.id}
                            className="flex items-center justify-between gap-4 py-2 pl-12 pr-4"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm text-gray-800">
                                {val.labelEn}
                                <span className="ml-2 text-xs text-gray-400">
                                  {val.labelRu} · {val.labelHy}
                                </span>
                              </p>
                              <p className="font-mono text-xs text-gray-400">{val.slug}</p>
                            </div>
                            <div className="flex shrink-0 gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingValue({ categoryId: cat.id, value: val })}
                              >
                                {STRINGS.edit}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => setToDelete({ kind: "value", value: val })}
                              >
                                {STRINGS.delete}
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      {/* Category create / edit */}
      {creatingCategory ? (
        <CategoryFormDialog open category={null} onClose={() => setCreatingCategory(false)} />
      ) : null}
      {editingCategory ? (
        <CategoryFormDialog
          open
          category={editingCategory}
          onClose={() => setEditingCategory(null)}
        />
      ) : null}

      {/* Value create / edit */}
      {creatingValueFor ? (
        <ValueFormDialog
          open
          categoryId={creatingValueFor.id}
          value={null}
          onClose={() => setCreatingValueFor(null)}
        />
      ) : null}
      {editingValue ? (
        <ValueFormDialog
          open
          categoryId={editingValue.categoryId}
          value={editingValue.value}
          onClose={() => setEditingValue(null)}
        />
      ) : null}

      {/* Guarded delete */}
      <ConfirmDialog
        open={!!toDelete}
        title={toDelete?.kind === "category" ? STRINGS.deleteCategoryTitle : STRINGS.deleteValueTitle}
        message={
          toDelete?.kind === "category"
            ? STRINGS.deleteCategoryBody(toDelete.category.labelEn)
            : toDelete?.kind === "value"
              ? STRINGS.deleteValueBody(toDelete.value.labelEn)
              : ""
        }
        confirmLabel={STRINGS.deleteConfirm}
        tone="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
