import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { FiscalDepartmentReader } from '../../application/ports/fiscal-department.reader';

/**
 * FISCAL-DEPT-1: reads a branch's registered fiscal department codes from the
 * FiscalConfig owned by (restaurantId, branchId). Read-only projection of a single
 * scalar (`dep`) — never touches cert/key/device secrets. Returns [] when the
 * branch has no fiscal config (or no departments), which makes any non-null `dep`
 * assignment fail validation (INVALID_FISCAL_DEPARTMENT) until the branch is set up.
 */
@Injectable()
export class PrismaFiscalDepartmentReader implements FiscalDepartmentReader {
  constructor(private readonly prisma: PrismaService) {}

  async listDeps(restaurantId: string, branchId: string): Promise<string[]> {
    const cfg = await this.prisma.fiscalConfig.findUnique({
      where: { restaurantId_branchId: { restaurantId, branchId } },
      select: { departments: { select: { dep: true } } },
    });
    return cfg ? cfg.departments.map((d) => d.dep) : [];
  }
}
