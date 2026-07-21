import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  CreatePairingCodeInput,
  EdgePairingCodeRecord,
  EdgePairingCodeRepository,
} from '../../domain/repositories/edge-pairing-code.repository';

@Injectable()
export class PrismaEdgePairingCodeRepository implements EdgePairingCodeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreatePairingCodeInput): Promise<void> {
    await this.prisma.edgePairingCode.create({ data: input });
  }

  async findRedeemable(codeHash: string, now: Date): Promise<EdgePairingCodeRecord | null> {
    const row = await this.prisma.edgePairingCode.findFirst({
      where: { codeHash, consumedAt: null, expiresAt: { gt: now } },
    });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      codeHash: row.codeHash,
      organizationId: row.organizationId,
      restaurantId: row.restaurantId,
      branchId: row.branchId,
      name: row.name,
      createdByUserId: row.createdByUserId,
      expiresAt: row.expiresAt,
      consumedAt: row.consumedAt,
      nodeId: row.nodeId,
    };
  }

  async consume(id: string, nodeId: string, at: Date): Promise<boolean> {
    // Conditional update: only the first caller (consumedAt still null AND not yet
    // expired) wins. updateMany returns the affected count without throwing.
    const result = await this.prisma.edgePairingCode.updateMany({
      where: { id, consumedAt: null, expiresAt: { gt: at } },
      data: { consumedAt: at, nodeId },
    });
    return result.count === 1;
  }
}
