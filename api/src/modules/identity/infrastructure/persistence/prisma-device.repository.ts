import { Injectable } from '@nestjs/common';
import { Device as PrismaDevice } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { Device, DeviceStatus, DeviceSurface } from '../../domain/entities/device';
import { DeviceRepository } from '../../domain/repositories/device.repository';

@Injectable()
export class PrismaDeviceRepository implements DeviceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(device: Device): Promise<void> {
    await this.prisma.device.create({
      data: {
        id: device.id,
        restaurantId: device.restaurantId,
        branchId: device.branchId,
        label: device.label,
        surface: device.surface as DeviceSurface,
        deviceSecretHash: device.deviceSecretHash,
        enrolledByUserId: device.enrolledByUserId,
        enrolledIp: device.enrolledIp,
        enrolledCidr: device.enrolledCidr,
        status: device.status as DeviceStatus,
        lastSeenAt: device.lastSeenAt,
        lastSeenIp: device.lastSeenIp,
        createdAt: device.createdAt,
        updatedAt: device.updatedAt,
      },
    });
  }

  async update(device: Device): Promise<void> {
    await this.prisma.device.update({
      where: { id: device.id },
      data: {
        label: device.label,
        status: device.status as DeviceStatus,
        lastSeenAt: device.lastSeenAt,
        lastSeenIp: device.lastSeenIp,
        updatedAt: device.updatedAt,
      },
    });
  }

  async findActiveBySecretHash(secretHash: string): Promise<Device | null> {
    const r = await this.prisma.device.findFirst({
      where: { deviceSecretHash: secretHash, status: 'ACTIVE' },
    });
    return r ? this.toDomain(r) : null;
  }

  async findByIdInBranch(
    restaurantId: string,
    branchId: string,
    id: string,
  ): Promise<Device | null> {
    const r = await this.prisma.device.findFirst({
      where: { id, restaurantId, branchId },
    });
    return r ? this.toDomain(r) : null;
  }

  async listByBranch(restaurantId: string, branchId: string): Promise<Device[]> {
    const records = await this.prisma.device.findMany({
      where: { restaurantId, branchId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  private toDomain(r: PrismaDevice): Device {
    return Device.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      label: r.label,
      surface: r.surface as DeviceSurface,
      deviceSecretHash: r.deviceSecretHash,
      enrolledByUserId: r.enrolledByUserId,
      enrolledIp: r.enrolledIp,
      enrolledCidr: r.enrolledCidr,
      status: r.status as DeviceStatus,
      lastSeenAt: r.lastSeenAt,
      lastSeenIp: r.lastSeenIp,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }
}
