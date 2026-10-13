'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { useCatalogControllerClone } from '@/api/generated/catalog/catalog';
import {
  CloneBodyDtoConflictStrategy,
  CloneBodyDtoMode,
  type CatalogReportResponse,
  type CloneBodyDtoIncludeItem,
} from '@/api/generated/model';
import {
  ALL_INCLUDED,
  IncludeFilters,
  toIncludeArray,
  type IncludeState,
} from '@/components/catalog/include-filters';
import { ImportReport } from '@/components/catalog/import-report';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/form';
import { getErrorMessage } from '@/lib/api-error';
import { useBranchContext } from '@/lib/branch/use-branch-context';
import { useCatalogRefetch } from '@/lib/catalog/use-catalog-refetch';
import { toast } from '@/stores/toast';

export function ClonePanel({
  branchId,
  branchName,
}: {
  branchId: string;
  branchName: string;
}) {
  const t = useTranslations('catalog');
  const refetch = useCatalogRefetch();
  const { accessibleBranches } = useBranchContext();
  const cloneMutation = useCatalogControllerClone();

  // Source = any accessible branch other than the active (target) one.
  const sources = useMemo(
    () => accessibleBranches.filter((b) => b.id !== branchId),
    [accessibleBranches, branchId],
  );

  const [sourceId, setSourceId] = useState('');
  const [conflictStrategy, setConflictStrategy] =
    useState<CloneBodyDtoConflictStrategy>(CloneBodyDtoConflictStrategy.SKIP);
  const [include, setInclude] = useState<IncludeState>(ALL_INCLUDED);
  const [report, setReport] = useState<CatalogReportResponse | null>(null);
  const [previewed, setPreviewed] = useState(false);

  const submit = async (mode: CloneBodyDtoMode) => {
    if (!sourceId) return;
    try {
      const result = await cloneMutation.mutateAsync({
        branchId,
        sourceBranchId: sourceId,
        data: {
          mode,
          conflictStrategy,
          include: toIncludeArray(include) as CloneBodyDtoIncludeItem[] | undefined,
        },
      });
      setReport(result);
      if (mode === CloneBodyDtoMode.DRY_RUN) {
        setPreviewed(true);
      } else {
        toast.success(t('toast.cloned'));
        await refetch();
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const applyBlocked = !previewed || !sourceId || (report ? !report.ok : true);

  if (sources.length === 0) {
    return <p className="text-sm text-gray-500">{t('noCloneSources')}</p>;
  }

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-gray-600">{t('cloneHint', { branch: branchName })}</p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-sm font-medium text-gray-700">{t('sourceBranch')}</span>
          <select
            className={inputClass}
            value={sourceId}
            onChange={(e) => {
              setSourceId(e.target.value);
              setReport(null);
              setPreviewed(false);
            }}
          >
            <option value="">{t('selectSource')}</option>
            {sources.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-sm font-medium text-gray-700">{t('conflictStrategy')}</span>
          <select
            className={inputClass}
            value={conflictStrategy}
            onChange={(e) =>
              setConflictStrategy(e.target.value as CloneBodyDtoConflictStrategy)
            }
          >
            <option value={CloneBodyDtoConflictStrategy.SKIP}>{t('strategySkip')}</option>
            <option value={CloneBodyDtoConflictStrategy.OVERWRITE}>
              {t('strategyOverwrite')}
            </option>
          </select>
        </label>
      </div>

      <IncludeFilters value={include} onChange={setInclude} />

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => submit(CloneBodyDtoMode.DRY_RUN)}
          disabled={!sourceId || cloneMutation.isPending}
        >
          {t('preview')}
        </Button>
        <Button
          variant="primary"
          onClick={() => submit(CloneBodyDtoMode.APPLY)}
          disabled={applyBlocked || cloneMutation.isPending}
          title={applyBlocked ? t('applyBlockedHint') : undefined}
        >
          {t('apply')}
        </Button>
      </div>

      {report && <ImportReport report={report} />}
    </div>
  );
}
