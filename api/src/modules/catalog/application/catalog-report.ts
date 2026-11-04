/**
 * Catalog import/clone report (BR-6). One counter block per section plus a flat
 * list of record-level errors. `ok` is false when a fatal missing-reference
 * forced a full rollback (APPLY) or would have (DRY_RUN).
 */

export interface SectionReport {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ key: string; message: string }>;
}

export type CatalogReportSections =
  | 'inventoryCategories'
  | 'suppliers'
  | 'inventoryItems'
  | 'processes'
  | 'menuCategories'
  | 'menuItems'
  | 'recipes';

export type CatalogReport = {
  ok: boolean;
  mode: 'DRY_RUN' | 'APPLY';
  conflictStrategy: 'SKIP' | 'OVERWRITE';
  sections: Record<CatalogReportSections, SectionReport>;
};

export function emptySectionReport(): SectionReport {
  return { created: 0, updated: 0, skipped: 0, errors: [] };
}

export function emptyReport(
  mode: 'DRY_RUN' | 'APPLY',
  conflictStrategy: 'SKIP' | 'OVERWRITE',
): CatalogReport {
  return {
    ok: true,
    mode,
    conflictStrategy,
    sections: {
      inventoryCategories: emptySectionReport(),
      suppliers: emptySectionReport(),
      inventoryItems: emptySectionReport(),
      processes: emptySectionReport(),
      menuCategories: emptySectionReport(),
      menuItems: emptySectionReport(),
      recipes: emptySectionReport(),
    },
  };
}
