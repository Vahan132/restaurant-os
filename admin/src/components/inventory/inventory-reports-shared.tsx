'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { inputClass } from '@/components/ui/form';
import { useBranchContext } from '@/lib/branch/use-branch-context';

/**
 * Reporting scope (BR-7): the branches the caller may see, whether they are
 * "Owner-capable" (more than one accessible branch — eligible for cross-branch
 * aggregate roll-ups), and a branch-name resolver. Single-branch users are
 * pinned to their one branch and never see the cross-branch aggregate.
 */
export function useReportScope() {
  const { accessibleBranches, activeBranchId, hasMultiple } = useBranchContext();
  const branchName = (id: string) =>
    accessibleBranches.find((b) => b.id === id)?.name ?? id;
  return {
    branches: accessibleBranches,
    activeBranchId,
    isOwner: hasMultiple,
    branchName,
  };
}

/** Filter-bar card matching the audit/reporting convention. */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
      {children}
    </div>
  );
}

/** Labeled select used across the report filter bars. */
export function FilterSelect({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="text-xs text-gray-600">
      <span className="mr-1 block">{label}</span>
      <select
        className={`${inputClass} w-auto`}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

/** Labeled date input. */
export function FilterDate({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
}) {
  return (
    <label className="text-xs text-gray-600">
      <span className="mr-1 block">{label}</span>
      <input
        type="date"
        className={`${inputClass} w-auto`}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/**
 * Branch filter. Owner-capable users get an "All branches" option (empty value
 * → cross-branch aggregate); single-branch users see only their branch.
 */
export function BranchFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useTranslations('inventory');
  const { branches, isOwner } = useReportScope();
  return (
    <FilterSelect label={t('repBranch')} value={value} onChange={onChange}>
      {isOwner && <option value="">{t('repAllBranches')}</option>}
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </FilterSelect>
  );
}
