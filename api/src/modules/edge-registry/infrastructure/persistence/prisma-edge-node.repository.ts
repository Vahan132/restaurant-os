import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { EdgeNode } from '../../domain/entities/edge-node';
import { EdgeNodeRepository } from '../../domain/repositories/edge-node.repository';
import { EdgeNodeMapper } from './edge-node.mapper';

@Injectable()
export class PrismaEdgeNodeRepository implements EdgeNodeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(node: EdgeNode): Promise<void> {
    await this.prisma.edgeNode.create({
      data: { id: node.id, ...EdgeNodeMapper.toRow(node) },
    });
  }

  async save(node: EdgeNode): Promise<void> {
    await this.prisma.edgeNode.update({
      where: { id: node.id },
      data: EdgeNodeMapper.toRow(node),
    });
  }

  async findById(restaurantId: string, id: string): Promise<EdgeNode | null> {
    const row = await this.prisma.edgeNode.findFirst({ where: { id, restaurantId } });
    return row ? EdgeNodeMapper.toDomain(row) : null;
  }

  async list(restaurantId: string): Promise<EdgeNode[]> {
    const rows = await this.prisma.edgeNode.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(EdgeNodeMapper.toDomain);
  }

  async findActiveByTokenHash(tokenHash: string): Promise<EdgeNode | null> {
    const row = await this.prisma.edgeNode.findFirst({
      where: { tokenHash, status: 'ACTIVE' },
    });
    return row ? EdgeNodeMapper.toDomain(row) : null;
  }

  async touchLastSeen(nodeId: string, at: Date): Promise<void> {
    await this.prisma.edgeNode.update({ where: { id: nodeId }, data: { lastSeenAt: at } });
  }

  async recordSnapshot(nodeId: string, at: Date, schemaVersion: string): Promise<void> {
    await this.prisma.edgeNode.update({
      where: { id: nodeId },
      data: { lastSnapshotAt: at, lastSeenAt: at, schemaVersion },
    });
  }

  async revokeActiveForBranch(restaurantId: string, branchId: string): Promise<number> {
    const result = await this.prisma.edgeNode.updateMany({
      where: { restaurantId, branchId, status: 'ACTIVE' },
      data: { status: 'REVOKED' },
    });
    return result.count;
  }

  async setFiscalKek(
    nodeId: string,
    kek: { cipher: Buffer; iv: Buffer; authTag: Buffer },
  ): Promise<void> {
    await this.prisma.edgeNode.update({
      where: { id: nodeId },
      data: {
        fiscalKekCipher: kek.cipher,
        fiscalKekIv: kek.iv,
        fiscalKekAuthTag: kek.authTag,
      },
    });
  }
}
