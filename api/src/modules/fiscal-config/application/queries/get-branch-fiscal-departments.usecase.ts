import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  BranchFiscalDepartments,
  TENANT_FISCAL_DEPARTMENT_READER,
  TenantFiscalDepartmentReader,
} from '../ports/tenant-fiscal-department.reader';

export interface GetBranchFiscalDepartmentsInput {
  /** From the verified tenant context — never a client-supplied id. */
  restaurantId: string | null;
  /** Resolved from the X-Branch-Id context (@ActiveBranchId), not a path/body param. */
  branchId: string;
}

/**
 * FISCAL-DEPT-3A: return the CALLER's branch's non-secret fiscal departments for
 * the menu editor's department dropdown. Both ids come from the request context,
 * so a caller cannot read another branch's departments.
 */
@Injectable()
export class GetBranchFiscalDepartmentsUseCase
  implements UseCase<GetBranchFiscalDepartmentsInput, BranchFiscalDepartments>
{
  constructor(
    @Inject(TENANT_FISCAL_DEPARTMENT_READER)
    private readonly reader: TenantFiscalDepartmentReader,
  ) {}

  async execute(input: GetBranchFiscalDepartmentsInput): Promise<BranchFiscalDepartments> {
    // Defensive: an org-level principal with no restaurant in scope has no branch
    // fiscal config to read — return the empty/disabled shape rather than error
    // (and never leak anything).
    if (!input.restaurantId) {
      return { fiscalActive: false, departments: [] };
    }
    return this.reader.getBranchDepartments(input.restaurantId, input.branchId);
  }
}
