"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  usePlatformConsumerListingControllerPostValue,
  usePlatformConsumerListingControllerPatchValue,
  getPlatformConsumerListingControllerListAttributesQueryKey,
} from "@/api/generated/endpoints/platform-consumer-listing/platform-consumer-listing";
import type { AttributeValueResponse } from "@/api/generated/model";
import { Modal } from "@/components/ui/dialog";
import { Button, Field, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/errors";
import { LabelFields, labelsComplete, type TrilingualLabels } from "@/components/attributes/label-fields";
import { STRINGS, SLUG_RE } from "@/components/attributes/strings";

/**
 * Create / edit an attribute value within a category.
 *
 * - On create the value is posted to the parent category (`categoryId`).
 * - `slug` is create-only (UpdateAttributeValueDto has no slug), read-only on edit.
 * - All three language labels required on create.
 */
export function ValueFormDialog({
  open,
  categoryId,
  value,
  onClose,
}: {
  open: boolean;
  /** Parent category — required to create a value. */
  categoryId: string;
  value: AttributeValueResponse | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const create = usePlatformConsumerListingControllerPostValue();
  const update = usePlatformConsumerListingControllerPatchValue();
  const isEdit = !!value;

  const [slug, setSlug] = useState(value?.slug ?? "");
  const [labels, setLabels] = useState<TrilingualLabels>({
    labelEn: value?.labelEn ?? "",
    labelRu: value?.labelRu ?? "",
    labelHy: value?.labelHy ?? "",
  });
  const [position, setPosition] = useState<string>(value ? String(value.position) : "");
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
      if (isEdit && value) {
        await update.mutateAsync({
          id: value.id,
          data: {
            labelEn: labels.labelEn.trim(),
            labelRu: labels.labelRu.trim(),
            labelHy: labels.labelHy.trim(),
            position: positionValue,
          },
        });
        toast.success(STRINGS.valueUpdated);
      } else {
        await create.mutateAsync({
          id: categoryId,
          data: {
            slug: slug.trim(),
            labelEn: labels.labelEn.trim(),
            labelRu: labels.labelRu.trim(),
            labelHy: labels.labelHy.trim(),
            position: positionValue,
          },
        });
        toast.success(STRINGS.valueCreated);
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
      title={isEdit ? STRINGS.editValueTitle : STRINGS.createValueTitle}
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
            placeholder="rooftop"
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

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            {STRINGS.cancel}
          </Button>
          <Button type="submit" loading={saving}>
            {isEdit ? STRINGS.saveChanges : STRINGS.createValueSubmit}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
