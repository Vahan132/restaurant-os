import 'reflect-metadata';
import { normalizeAndValidateDep } from './dep-assignment.util';
import { FiscalDepartmentReader } from './ports/fiscal-department.reader';

/**
 * FISCAL-DEPT-1 — the single source of truth for `dep` assignment validation,
 * shared by the create + update menu-item use cases.
 */
class FakeDeptReader implements FiscalDepartmentReader {
  public calls = 0;
  constructor(private readonly deps: string[]) {}
  async listDeps(): Promise<string[]> {
    this.calls += 1;
    return this.deps;
  }
}

describe('normalizeAndValidateDep (FISCAL-DEPT-1)', () => {
  it('returns a dep that exists in the branch set', async () => {
    const reader = new FakeDeptReader(['1', '2', '3']);
    await expect(normalizeAndValidateDep(reader, 'r1', 'b1', '2')).resolves.toBe('2');
  });

  it('trims surrounding whitespace before validating', async () => {
    const reader = new FakeDeptReader(['1', '2']);
    await expect(normalizeAndValidateDep(reader, 'r1', 'b1', '  2 ')).resolves.toBe('2');
  });

  it('rejects a dep that is not in the branch set with INVALID_FISCAL_DEPARTMENT', async () => {
    const reader = new FakeDeptReader(['1', '2']);
    await expect(normalizeAndValidateDep(reader, 'r1', 'b1', '9')).rejects.toMatchObject({
      response: { code: 'INVALID_FISCAL_DEPARTMENT' },
    });
  });

  it('rejects any dep when the branch has no departments (empty set)', async () => {
    const reader = new FakeDeptReader([]);
    await expect(normalizeAndValidateDep(reader, 'r1', 'b1', '1')).rejects.toMatchObject({
      response: { code: 'INVALID_FISCAL_DEPARTMENT' },
    });
  });

  it('allows clearing with null and skips the branch read entirely', async () => {
    const reader = new FakeDeptReader(['1']);
    await expect(normalizeAndValidateDep(reader, 'r1', 'b1', null)).resolves.toBeNull();
    expect(reader.calls).toBe(0);
  });

  it('treats a blank/empty string as a clear (null), no read', async () => {
    const reader = new FakeDeptReader(['1']);
    await expect(normalizeAndValidateDep(reader, 'r1', 'b1', '   ')).resolves.toBeNull();
    expect(reader.calls).toBe(0);
  });
});
