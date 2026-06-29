/**
 * Status of an import batch (5A). Mirrors the Prisma `ImportBatchStatus` enum.
 * Pure domain — no framework imports.
 *
 *  - PENDING   : created, not yet processed.
 *  - COMPLETED : every data row imported (errorCount === 0, successCount > 0).
 *  - PARTIAL   : the file was structurally valid but some rows were skipped
 *                (invalid OR duplicate). Includes the "0 imported, all rows
 *                rejected" case — the file parsed, it just had no usable rows.
 *  - FAILED    : the file was structurally invalid (unparseable, empty, or
 *                missing required columns) — nothing imported.
 */
export enum ImportBatchStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
}
