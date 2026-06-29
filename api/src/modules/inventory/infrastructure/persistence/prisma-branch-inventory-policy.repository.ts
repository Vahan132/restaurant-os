import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { BranchInventoryPolicy } from '../../domain/entities/branch-inventory-policy';
import { BranchInventoryPolicyRepository } from '../../domain/repositories/branch-inventory-policy.repository';
import { NegativeStockMode } from '../../domain/enums';
import { BranchInventoryPolicyMapper } from './inventory.mappers';

@Injectable()
export class PrismaBranchInventoryPolicyRepository implements BranchInventoryPolicyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async find(restaurantId: string, branchId: string): Promise<BranchInventoryPolicy | null> {
    const r = await this.prisma.branchInventoryPolicy.findFirst({
      where: { restaurantId, branchId },
    });
    return r ? BranchInventoryPolicyMapper.toDomain(r) : null;
  }

  async upsert(policy: BranchInventoryPolicy): Promise<void> {
    await this.prisma.branchInventoryPolicy.upsert({
      where: {
        restaurantId_branchId: {
          restaurantId: policy.restaurantId,
          branchId: policy.branchId,
        },
      },
      create: {
        id: policy.id,
        restaurantId: policy.restaurantId,
        branchId: policy.branchId,
        negativeStockMode: policy.negativeStockMode as NegativeStockMode,
      },
      update: { negativeStockMode: policy.negativeStockMode as NegativeStockMode },
    });
  }
}
