import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  BranchFiscalDepartments,
  TenantFiscalDepartmentReader,
} from '../../application/ports/tenant-fiscal-department.reader';

/**
 * FISCAL-DEPT-3A: reads a branch's NON-SECRET fiscal departments. The Prisma
 * `select` below is the security boundary — it lists ONLY `active` and each
 * department's `dep`/`label`/`taxRegime`. No cert/key, device host/port/password,
 * CRN, cashier, or environment column is selected, so no secret can leak through
 * this reader even by accident. Returns the empty/disabled shape when the branch
 * has no fiscal config row.
 */
@Injectable()
export class PrismaTenantFiscalDepartmentReader implements TenantFiscalDepartmentReader {
  constructor(private readonly prisma: PrismaService) {}

  async getBranchDepartments(
    restaurantId: string,
    branchId: string,
  ): Promise<BranchFiscalDepartments> {
    const cfg = await this.prisma.fiscalConfig.findUnique({
      where: { restaurantId_branchId: { restaurantId, branchId } },
      select: {
        active: true,
        departments: {
          orderBy: { dep: 'asc' },
          select: { dep: true, label: true, taxRegime: true },
        },
      },
    });
    if (!cfg) {
      return { fiscalActive: false, departments: [] };
    }
    return {
      fiscalActive: cfg.active,
      departments: cfg.departments.map((d) => ({
        dep: d.dep,
        label: d.label,
        taxRegime: d.taxRegime,
      })),
    };
  }
}
