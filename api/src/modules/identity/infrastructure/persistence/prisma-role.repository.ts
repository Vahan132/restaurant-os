import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { Role } from '../../domain/entities/role';
import { RoleRepository } from '../../domain/repositories/role.repository';
import { RoleMapper } from './role.mapper';

/** Prisma-backed RoleRepository. Every method is scoped by organizationId. */
@Injectable()
export class PrismaRoleRepository implements RoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string): Promise<Role[]> {
    const records = await this.prisma.role.findMany({
      where: { organizationId },
      orderBy: { code: 'asc' },
    });
    return records.map(RoleMapper.toDomain);
  }

  async findById(organizationId: string, id: string): Promise<Role | null> {
    const record = await this.prisma.role.findFirst({ where: { id, organizationId } });
    return record ? RoleMapper.toDomain(record) : null;
  }

  async findByCode(organizationId: string, code: string): Promise<Role | null> {
    const record = await this.prisma.role.findFirst({ where: { organizationId, code } });
    return record ? RoleMapper.toDomain(record) : null;
  }

  async existsByCode(organizationId: string, code: string): Promise<boolean> {
    const count = await this.prisma.role.count({ where: { organizationId, code } });
    return count > 0;
  }

  async create(role: Role): Promise<void> {
    await this.prisma.role.create({ data: RoleMapper.toCreate(role) });
  }

  async update(role: Role): Promise<void> {
    await this.prisma.role.updateMany({
      where: { id: role.id, organizationId: role.organizationId },
      data: RoleMapper.toUpdate(role),
    });
  }

  async delete(organizationId: string, id: string): Promise<void> {
    await this.prisma.role.deleteMany({ where: { id, organizationId } });
  }

  async countUsers(organizationId: string, roleId: string): Promise<number> {
    return this.prisma.user.count({ where: { organizationId, roleId, deletedAt: null } });
  }
}
