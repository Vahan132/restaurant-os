/**
 * UI chrome strings for the platform Catalog screen + its CSV import panel.
 *
 * PA-UI has no i18n framework — the established convention (see
 * components/attributes/strings.ts and organizations/suppression-control.tsx)
 * is a co-located `STRINGS` object of English literals. We follow that here.
 * The catalog *data* (slug / nameHy / nameRu / nameEn …) is the content being
 * managed and is NOT part of this chrome.
 */
export const STRINGS = {
  // Page
  title: "Catalog",
  description:
    "Platform-wide catalog items — the shared dish vocabulary restaurants adopt from. Curated centrally; bulk-imported from CSV.",
  importCsv: "Import CSV",
  searchPlaceholder: "Search slug or name…",

  // List states
  emptyTitle: "No catalog items yet",
  emptyDescription: "Import a CSV to populate the platform catalog.",
  emptyFilteredTitle: "No matching items",
  emptyFilteredDescription: "No catalog items match your search.",
  loadError: "Couldn’t load catalog items",

  // Column headers
  colSlug: "Slug",
  colName: "Name",
  colCategory: "Category",
  colStatus: "Status",

  // Import panel
  importTitle: "Import catalog items",
  importIntro:
    "Upload a CSV, preview a dry-run diff, then apply. The backend parses and validates the file — nothing is written until you apply a clean preview.",
  downloadTemplate: "Download template",
  chooseFile: "Choose CSV file",
  noFileChosen: "No file selected",
  fileLoaded: (name: string) => `Loaded: ${name}`,

  conflictLegend: "On slug collision",
  conflictOverwrite: "Overwrite existing",
  conflictSkip: "Skip existing",

  preview: "Preview",
  previewing: "Previewing…",
  apply: "Apply import",
  applying: "Applying…",
  close: "Close",

  // Summary bar
  sumTotal: "Total",
  sumCreate: "Create",
  sumUpdate: "Update",
  sumUnchanged: "Unchanged",
  sumSkipped: "Skipped",
  sumErrors: "Errors",

  // Row table
  rowLine: "Line",
  rowSlug: "Slug",
  rowAction: "Action",
  rowMessages: "Messages",
  noRows: "No rows in this preview.",

  // Helpers / toasts
  errorsHelp:
    "Some rows have errors. Fix the file and re-preview — Apply stays disabled until the dry-run is clean.",
  previewStale:
    "The file or conflict strategy changed. Re-run Preview before applying.",
  applyRefused:
    "Import was refused because rows still have errors. Fix the file and preview again.",
  applySuccess: "Import applied",
  applySuccessDetail: (s: { toCreate: number; toUpdate: number; skipped: number }) =>
    `${s.toCreate} created · ${s.toUpdate} updated · ${s.skipped} skipped`,
  previewFailed: "Preview failed",
  applyFailed: "Apply failed",
} as const;

/**
 * CSV template columns, in order. Mirrors the backend importer's expected
 * header row. Kept here (not derived from a model) because the CSV shape is a
 * transport contract owned by the import endpoint, not the CatalogItem model.
 */
export const TEMPLATE_COLUMNS = [
  "slug",
  "nameHy",
  "nameRu",
  "nameEn",
  "category",
  "status",
] as const;

/**
 * Client-side template: header row + one commented example row. CSV has no
 * native comment syntax; the importer treats a leading `#` as a skipped
 * comment line, so the example is illustrative without being imported.
 */
export function buildTemplateCsv(): string {
  const header = TEMPLATE_COLUMNS.join(",");
  const example =
    "# khorovats,Խորոved,Хоровац,Grilled pork,mains,ACTIVE";
  return `${header}\n${example}\n`;
}

/** Action → badge tone for the preview row table. */
export function actionTone(
  action: string,
): "green" | "blue" | "gray" | "yellow" | "red" {
  switch (action) {
    case "CREATE":
      return "green";
    case "UPDATE":
      return "blue";
    case "UNCHANGED":
      return "gray";
    case "SKIP":
      return "yellow";
    case "ERROR":
      return "red";
    default:
      return "gray";
  }
}
