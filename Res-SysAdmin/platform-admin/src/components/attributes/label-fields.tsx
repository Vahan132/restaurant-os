"use client";

import { Field, Input } from "@/components/ui/primitives";
import { STRINGS } from "@/components/attributes/strings";

export interface TrilingualLabels {
  labelEn: string;
  labelRu: string;
  labelHy: string;
}

/**
 * The three per-language label inputs (English / Russian / Armenian), all
 * required on create. Shared by the category and value dialogs since PA-UI has
 * no existing trilingual-input pattern.
 */
export function LabelFields({
  value,
  onChange,
}: {
  value: TrilingualLabels;
  onChange: (next: TrilingualLabels) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Field label={STRINGS.labelEnLabel} required>
        <Input
          value={value.labelEn}
          onChange={(e) => onChange({ ...value, labelEn: e.target.value })}
          required
        />
      </Field>
      <Field label={STRINGS.labelRuLabel} required>
        <Input
          value={value.labelRu}
          onChange={(e) => onChange({ ...value, labelRu: e.target.value })}
          required
        />
      </Field>
      <Field label={STRINGS.labelHyLabel} required>
        <Input
          value={value.labelHy}
          onChange={(e) => onChange({ ...value, labelHy: e.target.value })}
          required
        />
      </Field>
    </div>
  );
}

export function labelsComplete(v: TrilingualLabels): boolean {
  return v.labelEn.trim() !== "" && v.labelRu.trim() !== "" && v.labelHy.trim() !== "";
}
