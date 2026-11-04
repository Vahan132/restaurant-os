"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  usePlatformConsumerListingControllerPostCategory,
  usePlatformConsumerListingControllerPatchCategory,
  getPlatformConsumerListingControllerListAttributesQueryKey,
} from "@/api/generated/endpoints/platform-consumer-listing/platform-consumer-listing";
import type { AttributeCategoryResponse } from "@/api/generated/model";
import { Modal } from "@/components/ui/dialog";
import { Button, Field, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/errors";
import { LabelFields, labelsComplete, type TrilingualLabels } from "@/components/attributes/label-fields";
import { STRINGS, SLUG_RE } from "@/components/attributes/strings";

/**
 * Create / edit an attribute category.
 *
 * - `slug` is create-only: shown and validated on create, rendered read-only on
 *   edit (the UpdateAttributeCategoryDto has no slug — renaming would break
 *   restaurants' existing selections).
 * - All three language labels are required on create.
 * - `isFilterable` controls whether the category appears in the consumer filter
 *   sheet; a short helper explains it.
 */
export function CategoryFormDialog({
  open,
  category,
  onClose,
}: {
  open: boolean;
  category: AttributeCategoryResponse | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const create = usePlatformConsumerListingControllerPostCategory();
  const update = usePlatformConsumerListingControllerPatchCategory();
  const isEdit = !!category;

  const [slug, setSlug] = useState(category?.slug ?? "");
  const [labels, setLabels] = useState<TrilingualLabels>({
    labelEn: category?.labelEn ?? "",
    labelRu: category?.labelRu ?? "",
    labelHy: category?.labelHy ?? "",
  });
  const [position, setPosition] = useState<string>(
    category ? String(category.position) : "",
  );
  const [isFilterable, setIsFilterable] = useState<boolean>(category?.isFilterable ?? true);
  const [error, setError] = useState<string | null>(null);

  function validate(): boolean {
    if (!isEdit) {
      if (slug.trim() === "") {
        setError(STRINGS.slugRequired);
        return false;
      }
      if (!SLUG_RE.test(slug.trim())) {
        setError(STRINGS.slugInvalid);
        return false;
      }
    }
    if (!labelsComplete(labels)) {
      setError(STRINGS.labelsRequired);
      return false;
    }
    setError(null);
    return true;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const positionValue =
      position.trim() === "" ? undefined : Math.max(0, Number(position) || 0);

    try {
      if (isEdit && category) {
        await update.mutateAsync({
          id: category.id,
          data: {
            labelEn: labels.labelEn.trim(),
            labelRu: labels.labelRu.trim(),
            labelHy: labels.labelHy.trim(),
            position: positionValue,
            isFilterable,
          },
        });
        toast.success(STRINGS.categoryUpdated);
      } else {
        await create.mutateAsync({
          data: {
            slug: slug.trim(),
            labelEn: labels.labelEn.trim(),
            labelRu: labels.labelRu.trim(),
            labelHy: labels.labelHy.trim(),
            position: positionValue,
            isFilterable,
          },
        });
        toast.success(STRINGS.categoryCreated);
      }
      void queryClient.invalidateQueries({
        queryKey: getPlatformConsumerListingControllerListAttributesQueryKey(),
      });
      onClose();
    } catch (err) {
      toast.error(isEdit ? STRINGS.updateFailed : STRINGS.createFailed, getErrorMessage(err));
    }
  }

  const saving = create.isPending || update.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? STRINGS.editCategoryTitle : STRINGS.createCategoryTitle}
      widthClass="max-w-2xl"
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <Field
          label={STRINGS.slugLabel}
          required={!isEdit}
          hint={isEdit ? STRINGS.slugHintEdit : STRINGS.slugHintCreate}
        >
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={isEdit}
            required={!isEdit}
            placeholder="outdoor-seating"
            className="font-mono"
          />
        </Field>

        <LabelFields value={labels} onChange={setLabels} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={STRINGS.positionLabel} hint={STRINGS.positionHint}>
            <Input
              type="number"
              min="0"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
          </Field>
        </div>

        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">{STRINGS.filterableLabel}</p>
              <p className="mt-0.5 text-xs text-gray-500">{STRINGS.filterableHelp}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isFilterable}
              aria-label={STRINGS.filterableLabel}
              onClick={() => setIsFilterable((v) => !v)}
              className={
                "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 " +
                (isFilterable ? "bg-brand-600" : "bg-gray-300")
              }
            >
              <span
                className={
                  "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform " +
                  (isFilterable ? "translate-x-5" : "translate-x-0.5")
                }
              />
            </button>
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            {STRINGS.cancel}
          </Button>
          <Button type="submit" loading={saving}>
            {isEdit ? STRINGS.saveChanges : STRINGS.createCategorySubmit}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
