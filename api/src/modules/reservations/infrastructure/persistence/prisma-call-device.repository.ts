import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { CallDevice } from '../../domain/entities/call-device';
import { CallDeviceStatus } from '../../domain/enums';
import { CallDeviceRepository } from '../../domain/repositories/call-device.repository';
import { CallDeviceMapper } from './call-device.mapper';

@Injectable()
export class PrismaCallDeviceRepository implements CallDeviceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(device: CallDevice): Promise<void> {
    await this.prisma.callDevice.create({
      data: { id: device.id, ...CallDeviceMapper.toRow(device) },
    });
  }

  async save(device: CallDevice): Promise<void> {
    await this.prisma.callDevice.update({
      where: { id: device.id },
      data: CallDeviceMapper.toRow(device),
    });
  }

  async findById(restaurantId: string, branchId: string, id: string): Promise<CallDevice | null> {
    const row = await this.prisma.callDevice.findFirst({ where: { id, restaurantId, branchId } });
    return row ? CallDeviceMapper.toDomain(row) : null;
  }

  async list(restaurantId: string, branchId: string): Promise<CallDevice[]> {
    const rows = await this.prisma.callDevice.findMany({
      where: { restaurantId, branchId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(CallDeviceMapper.toDomain);
  }

  async findActiveByTokenHash(tokenHash: string): Promise<CallDevice | null> {
    const row = await this.prisma.callDevice.findFirst({
      where: { tokenHash, status: CallDeviceStatus.ACTIVE },
    });
    return row ? CallDeviceMapper.toDomain(row) : null;
  }

  async touchLastSeen(deviceId: string, at: Date): Promise<void> {
    await this.prisma.callDevice.update({
      where: { id: deviceId },
      data: { lastSeenAt: at },
    });
  }
}
