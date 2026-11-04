'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useCatalogControllerImport } from '@/api/generated/catalog/catalog';
import {
  ImportBodyDtoConflictStrategy,
  ImportBodyDtoMode,
  type CatalogReportResponse,
  type ImportBodyDtoBundle,
} from '@/api/generated/model';
import { ImportReport } from '@/components/catalog/import-report';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/form';
import { getErrorMessage } from '@/lib/api-error';
import { useCatalogRefetch } from '@/lib/catalog/use-catalog-refetch';
import { toast } from '@/stores/toast';

export function ImportPanel({
  branchId,
  branchName,
}: {
  branchId: string;
  branchName: string;
}) {
  const t = useTranslations('catalog');
  const refetch = useCatalogRefetch();
  const importMutation = useCatalogControllerImport();

  const [fileName, setFileName] = useState('');
  const [bundle, setBundle] = useState<ImportBodyDtoBundle | null>(null);
  const [conflictStrategy, setConflictStrategy] =
    useState<ImportBodyDtoConflictStrategy>(ImportBodyDtoConflictStrategy.SKIP);
  const [report, setReport] = useState<CatalogReportResponse | null>(null);
  const [previewed, setPreviewed] = useState(false);

  const onFile = async (file: File | undefined) => {
    setReport(null);
    setPreviewed(false);
    if (!file) {
      setBundle(null);
      setFileName('');
      return;
    }
    setFileName(file.name);
    try {
      const text = await file.text();
      setBundle(JSON.parse(text) as ImportBodyDtoBundle);
    } catch {
      setBundle(null);
      toast.error(t('invalidJson'));
    }
  };

  const submit = async (mode: ImportBodyDtoMode) => {
    if (!bundle) return;
    try {
      const result = await importMutation.mutateAsync({
        branchId,
        data: { bundle, mode, conflictStrategy },
      });
      setReport(result);
      if (mode === ImportBodyDtoMode.DRY_RUN) {
        setPreviewed(true);
      } else {
        toast.success(t('toast.imported'));
        await refetch();
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // Block Apply until a clean dry-run (report.ok) has been produced.
  const applyBlocked = !previewed || !bundle || (report ? !report.ok : true);

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-gray-600">{t('importHint', { branch: branchName })}</p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-sm font-medium text-gray-700">{t('bundleFile')}</span>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="block text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-sm font-medium text-gray-700">{t('conflictStrategy')}</span>
          <select
            className={inputClass}
            value={conflictStrategy}
            onChange={(e) =>
              setConflictStrategy(e.target.value as ImportBodyDtoConflictStrategy)
            }
          >
            <option value={ImportBodyDtoConflictStrategy.SKIP}>{t('strategySkip')}</option>
            <option value={ImportBodyDtoConflictStrategy.OVERWRITE}>
              {t('strategyOverwrite')}
            </option>
          </select>
        </label>
      </div>

      {fileName && <p className="text-xs text-gray-500">{t('selectedFile', { name: fileName })}</p>}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => submit(ImportBodyDtoMode.DRY_RUN)}
          disabled={!bundle || importMutation.isPending}
        >
          {t('preview')}
        </Button>
        <Button
          variant="primary"
          onClick={() => submit(ImportBodyDtoMode.APPLY)}
          disabled={applyBlocked || importMutation.isPending}
          title={applyBlocked ? t('applyBlockedHint') : undefined}
        >
          {t('apply')}
        </Button>
      </div>

      {report && <ImportReport report={report} />}
    </div>
  );
}
