/** Browser download helpers for catalog export (BR-7 §5). */

function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Download a value as a pretty-printed JSON file. */
export function downloadJson(filename: string, data: unknown): void {
  triggerDownload(
    filename,
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
}

/** Download a prepared blob (e.g. the Excel item/price list). */
export function downloadBlob(filename: string, blob: Blob): void {
  triggerDownload(filename, blob);
}

/** Filename-safe slug from a branch name. */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'branch'
  );
}
