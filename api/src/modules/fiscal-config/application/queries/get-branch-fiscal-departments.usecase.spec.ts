import 'reflect-metadata';
import { BranchFiscalDepartmentsResponse } from '../../presentation/http/dto/branch-fiscal-departments.response';
import {
  BranchFiscalDepartments,
  TenantFiscalDepartmentReader,
} from '../ports/tenant-fiscal-department.reader';
import { GetBranchFiscalDepartmentsUseCase } from './get-branch-fiscal-departments.usecase';

/** FISCAL-DEPT-3A — tenant/branch-scoped non-secret departments read. */

class FakeReader implements TenantFiscalDepartmentReader {
  public calls: Array<{ restaurantId: string; branchId: string }> = [];
  constructor(private readonly result: BranchFiscalDepartments) {}
  async getBranchDepartments(restaurantId: string, branchId: string): Promise<BranchFiscalDepartments> {
    this.calls.push({ restaurantId, branchId });
    return this.result;
  }
}

describe('GetBranchFiscalDepartmentsUseCase', () => {
  it("returns the caller's own branch departments (dep + label + regime)", async () => {
    const reader = new FakeReader({
      fiscalActive: true,
      departments: [
        { dep: '1', label: 'Standard', taxRegime: 'VAT20' },
        { dep: '2', label: null, taxRegime: 'VAT0' },
      ],
    });
    const uc = new GetBranchFiscalDepartmentsUseCase(reader);

    const out = await uc.execute({ restaurantId: 'r1', branchId: 'b1' });

    expect(out.fiscalActive).toBe(true);
    expect(out.departments).toEqual([
      { dep: '1', label: 'Standard', taxRegime: 'VAT20' },
      { dep: '2', label: null, taxRegime: 'VAT0' },
    ]);
  });

  it('scopes strictly to the context ids — reads exactly (restaurantId, branchId) passed in', async () => {
    const reader = new FakeReader({ fiscalActive: false, departments: [] });
    const uc = new GetBranchFiscalDepartmentsUseCase(reader);

    await uc.execute({ restaurantId: 'r9', branchId: 'b9' });

    // The reader is called with the caller's own ids only — no way to target another branch.
    expect(reader.calls).toEqual([{ restaurantId: 'r9', branchId: 'b9' }]);
  });

  it('returns an empty list + fiscalActive:false for a branch with no departments', async () => {
    const reader = new FakeReader({ fiscalActive: false, departments: [] });
    const uc = new GetBranchFiscalDepartmentsUseCase(reader);

    const out = await uc.execute({ restaurantId: 'r1', branchId: 'b1' });

    expect(out).toEqual({ fiscalActive: false, departments: [] });
  });

  it('short-circuits to the empty/disabled shape when no restaurant is in scope (no read)', async () => {
    const reader = new FakeReader({ fiscalActive: true, departments: [{ dep: '1', label: null, taxRegime: 'X' }] });
    const uc = new GetBranchFiscalDepartmentsUseCase(reader);

    const out = await uc.execute({ restaurantId: null, branchId: 'b1' });

    expect(out).toEqual({ fiscalActive: false, departments: [] });
    expect(reader.calls).toHaveLength(0);
  });
});

describe('BranchFiscalDepartmentsResponse (non-secret DTO)', () => {
  it('serializes ONLY fiscalActive + dep/label/taxRegime — no secret fields', () => {
    const res = BranchFiscalDepartmentsResponse.from({
      fiscalActive: true,
      departments: [{ dep: '1', label: 'Std', taxRegime: 'VAT20' }],
    });

    expect(Object.keys(res).sort()).toEqual(['departments', 'fiscalActive']);
    expect(Object.keys(res.departments[0]).sort()).toEqual(['dep', 'label', 'taxRegime']);

    // Belt-and-suspenders: none of the platform status secrets can appear.
    const blob = JSON.stringify(res);
    for (const secret of ['crn', 'cashierId', 'cert', 'device', 'Cipher', 'password', 'Host', 'Port']) {
      expect(blob.includes(secret)).toBe(false);
    }
  });
});
