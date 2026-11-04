import { InvalidFiscalDepartment } from './application.errors';
import { FiscalDepartmentReader } from './ports/fiscal-department.reader';

/**
 * FISCAL-DEPT-1: normalize a raw `dep` assignment (trim; '' → null) and validate a
 * non-null result against the branch's registered FiscalDepartment codes.
 *
 * Returns the normalized value (a branch-valid dep string, or null when cleared).
 * Clearing (null/blank) is always allowed and skips the DB read entirely. A
 * non-null value that is not one of the branch's deps throws
 * INVALID_FISCAL_DEPARTMENT. Mirrors the adgCode normalization discipline but adds
 * membership validation, since an invalid dep would silently fiscalize under the
 * wrong VAT regime.
 */
export async function normalizeAndValidateDep(
  reader: FiscalDepartmentReader,
  restaurantId: string,
  branchId: string,
  raw: string | null,
): Promise<string | null> {
  const value = raw === null || raw.trim() === '' ? null : raw.trim();
  if (value === null) {
    return null;
  }
  const deps = await reader.listDeps(restaurantId, branchId);
  if (!deps.includes(value)) {
    throw InvalidFiscalDepartment();
  }
  return value;
}
