'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  getSalesImportControllerListQueryKey,
  useSalesImportControllerUpload,
} from '@/api/generated/sales-import/sales-import';
import type { ImportResultResponse } from '@/api/generated/model';
import { ImportResult } from '@/components/sales-import/import-result';
import { ColumnMapping } from '@/components/sales-import/column-mapping';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/api-error';
import {
  autoDetectMapping,
  buildCanonicalCsv,
  csvTextToFile,
  headersMatchCanonical,
  isMappingComplete,
  parseCsv,
  type ColumnMapping as ColumnMappingType,
  type ParsedCsv,
} from '@/lib/sales-import/canonical';
import { toast } from '@/stores/toast';

export function UploadPanel({ branchName }: { branchName: string }) {
  const t = useTranslations('salesImport');
  const qc = useQueryClient();
  const uploadMutation = useSalesImportControllerUpload();

  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [needsMapping, setNeedsMapping] = useState(false);
  const [mapping, setMapping] = useState<ColumnMappingType>({});
  const [result, setResult] = useState<ImportResultResponse | null>(null);

  const reset = () => {
    setFile(null);
    setParsed(null);
    setNeedsMapping(false);
    setMapping({});
    setResult(null);
  };

  const onFile = async (picked: File | undefined) => {
    setParsed(null);
    setNeedsMapping(false);
    setMapping({});
    setResult(null);
    if (!picked) {
      setFile(null);
      return;
    }
    setFile(picked);
    try {
      const text = await picked.text();
      const p = parseCsv(text);
      if (p.headers.length === 0) {
        setParsed(null);
        toast.error(t('emptyFile'));
        return;
      }
      setParsed(p);
      if (headersMatchCanonical(p.headers)) {
        // Headers already canonical — submit the file verbatim.
        setNeedsMapping(false);
      } else {
        // Mismatched headers — offer a mapping step (pre-filled best-guess).
        setNeedsMapping(true);
        setMapping(autoDetectMapping(p.headers));
      }
    } catch {
      setParsed(null);
      toast.error(t('readError'));
    }
  };

  const submit = async () => {
    if (!file || !parsed) return;
    let toUpload = file;
    if (needsMapping) {
      if (!isMappingComplete(mapping)) {
        toast.error(t('mappingIncomplete'));
        return;
      }
      // Rewrite to canonical headers so the backend receives a clean file.
      const csv = buildCanonicalCsv(parsed, mapping);
      toUpload = csvTextToFile(csv, file.name);
    }
    try {
      const res = await uploadMutation.mutateAsync({ data: { file: toUpload } });
      setResult(res);
      await qc.invalidateQueries({ queryKey: getSalesImportControllerListQueryKey() });
      if (res.status === 'COMPLETED') toast.success(t('toast.completed'));
      else if (res.status === 'PARTIAL') toast.info(t('toast.partial'));
      else toast.error(t('toast.failed'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="max-w-4xl space-y-4">
      <p className="text-sm text-gray-600">{t('uploadHint', { branch: branchName })}</p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-sm font-medium text-gray-700">{t('csvFile')}</span>
          <input
            type="file"
            accept="text/csv,.csv"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="block text-sm"
          />
        </label>
        {file && (
          <Button variant="ghost" size="sm" onClick={reset} disabled={uploadMutation.isPending}>
            {t('clear')}
          </Button>
        )}
      </div>

      {file && parsed && (
        <p className="text-xs text-gray-500">
          {t('fileSummary', { name: file.name, rows: parsed.rows.length })}
        </p>
      )}

      {parsed && needsMapping && !result && (
        <ColumnMapping headers={parsed.headers} mapping={mapping} onChange={setMapping} />
      )}

      {parsed && !needsMapping && !result && (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {t('headersMatch')}
        </p>
      )}

      {parsed && !result && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            onClick={submit}
            disabled={
              uploadMutation.isPending || (needsMapping && !isMappingComplete(mapping))
            }
          >
            {uploadMutation.isPending ? t('uploading') : t('upload')}
          </Button>
        </div>
      )}

      {result && (
        <>
          <ImportResult result={result} />
          <div>
            <Button variant="secondary" onClick={reset}>
              {t('importAnother')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
