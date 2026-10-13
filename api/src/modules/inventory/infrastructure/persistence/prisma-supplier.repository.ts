import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { Supplier } from '../../domain/entities/supplier';
import { SupplierRepository } from '../../domain/repositories/supplier.repository';
import { SupplierMapper } from './inventory.mappers';

@Injectable()
export class PrismaSupplierRepository implements SupplierRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    restaurantId: string,
    branchId: string,
    skip: number,
    take: number,
  ): Promise<{ items: Supplier[]; total: number }> {
    const where: Prisma.SupplierWhereInput = { restaurantId, branchId, deletedAt: null };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
      this.prisma.supplier.count({ where }),
    ]);
    return { items: records.map(SupplierMapper.toDomain), total };
  }

  async findById(restaurantId: string, branchId: string, id: string): Promise<Supplier | null> {
    const r = await this.prisma.supplier.findFirst({
      where: { id, restaurantId, branchId, deletedAt: null },
    });
    return r ? SupplierMapper.toDomain(r) : null;
  }

  async create(supplier: Supplier): Promise<void> {
    await this.prisma.supplier.create({ data: SupplierMapper.toCreate(supplier) });
  }

  async update(supplier: Supplier): Promise<void> {
    await this.prisma.supplier.updateMany({
      where: { id: supplier.id, restaurantId: supplier.restaurantId },
      data: SupplierMapper.toUpdate(supplier),
    });
  }
}
