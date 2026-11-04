'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useCatalogControllerExport } from '@/api/generated/catalog/catalog';
import {
  CatalogControllerExportFormat,
  type CatalogControllerExportIncludeItem,
  type CatalogControllerExportParams,
} from '@/api/generated/model';
import {
  ALL_INCLUDED,
  IncludeFilters,
  toIncludeArray,
  type IncludeState,
} from '@/components/catalog/include-filters';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/api-error';
import { downloadBlob, slugify } from '@/lib/catalog/download';
import { toast } from '@/stores/toast';

export function ExportPanel({
  branchId,
  branchName,
}: {
  branchId: string;
  branchName: string;
}) {
  const t = useTranslations('catalog');
  const [include, setInclude] = useState<IncludeState>(ALL_INCLUDED);
  // The export endpoint streams the bundle/workbook as the response body, so we
  // request a blob and download it client-side.
  const exportMutation = useCatalogControllerExport({
    request: { responseType: 'blob' },
  });

  const run = async (format: CatalogControllerExportFormat, ext: string) => {
    const params: CatalogControllerExportParams = {
      include: toIncludeArray(include) as
        | CatalogControllerExportIncludeItem[]
        | undefined,
      format,
    };
    try {
      const blob = (await exportMutation.mutateAsync({
        branchId,
        params,
      })) as unknown as Blob;
      downloadBlob(`${slugify(branchName)}-catalog.${ext}`, blob);
      toast.success(t('toast.exported'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-gray-600">{t('exportHint', { branch: branchName })}</p>
      <IncludeFilters value={include} onChange={setInclude} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={() => run(CatalogControllerExportFormat.json, 'json')}
          disabled={exportMutation.isPending}
        >
          {t('exportJson')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => run(CatalogControllerExportFormat.xlsx, 'xlsx')}
          disabled={exportMutation.isPending}
        >
          {t('exportXlsx')}
        </Button>
      </div>
    </div>
  );
}
