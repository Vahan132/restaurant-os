import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  FiscalConfigStatus,
  FiscalConfigStore,
  FiscalDepartmentInput,
  SetFiscalCertInput,
  UpsertFiscalConfigInput,
} from '../../application/ports/fiscal-config-store.port';
import { FiscalCryptoService } from '../crypto/fiscal-crypto.service';

/** Config not found for the given branch (a cert/department write before upsert). */
export class FiscalConfigNotFoundError extends Error {
  constructor(restaurantId: string, branchId: string) {
    super(`No fiscal config for ${restaurantId}:${branchId}.`);
    this.name = 'FiscalConfigNotFoundError';
  }
}

/**
 * Prisma-backed fiscal-config store (FISCAL-4). Config scalars and the cert are
 * SEPARATE writes: `upsertConfig` never touches secrets; `setCert` encrypts +
 * stores them (envelope). `getStatus` returns only non-secret fields plus a
 * `certConfigured` boolean. Tenant scoping is the (restaurantId, branchId) unique
 * key on every call.
 */
@Injectable()
export class PrismaFiscalConfigStore implements FiscalConfigStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: FiscalCryptoService,
  ) {}

  async upsertConfig(input: UpsertFiscalConfigInput): Promise<void> {
    const scalar = {
      crn: input.crn,
      cashierId: input.cashierId,
      environment: input.environment,
      language: input.language,
      active: input.active,
    };
    await this.prisma.fiscalConfig.upsert({
      where: {
        restaurantId_branchId: { restaurantId: input.restaurantId, branchId: input.branchId },
      },
      create: { restaurantId: input.restaurantId, branchId: input.branchId, ...scalar },
      update: scalar,
    });
  }

  async setCert(input: SetFiscalCertInput): Promise<void> {
    const exists = await this.prisma.fiscalConfig.findUnique({
      where: {
        restaurantId_branchId: { restaurantId: input.restaurantId, branchId: input.branchId },
      },
      select: { id: true },
    });
    if (!exists) {
      throw new FiscalConfigNotFoundError(input.restaurantId, input.branchId);
    }
    const w = this.crypto.wrap(
      Buffer.from(input.clientCertPem, 'utf8'),
      Buffer.from(input.clientKeyPem, 'utf8'),
    );
    await this.prisma.fiscalConfig.update({
      where: {
        restaurantId_branchId: { restaurantId: input.restaurantId, branchId: input.branchId },
      },
      data: {
        certCipher: w.cert.cipher,
        certIv: w.cert.iv,
        certAuthTag: w.cert.authTag,
        keyCipher: w.key.cipher,
        keyIv: w.key.iv,
        keyAuthTag: w.key.authTag,
        dekCipher: w.dek.cipher,
        dekIv: w.dek.iv,
        dekAuthTag: w.dek.authTag,
        kekVersion: w.kekVersion,
      },
    });
  }

  async setDepartments(
    restaurantId: string,
    branchId: string,
    departments: FiscalDepartmentInput[],
  ): Promise<void> {
    const cfg = await this.prisma.fiscalConfig.findUnique({
      where: { restaurantId_branchId: { restaurantId, branchId } },
      select: { id: true },
    });
    if (!cfg) {
      throw new FiscalConfigNotFoundError(restaurantId, branchId);
    }
    await this.prisma.$transaction([
      this.prisma.fiscalDepartment.deleteMany({ where: { fiscalConfigId: cfg.id } }),
      this.prisma.fiscalDepartment.createMany({
        data: departments.map((d) => ({
          fiscalConfigId: cfg.id,
          dep: d.dep,
          taxRegime: d.taxRegime,
          label: d.label ?? null,
        })),
      }),
    ]);
  }

  async getStatus(restaurantId: string, branchId: string): Promise<FiscalConfigStatus | null> {
    const cfg = await this.prisma.fiscalConfig.findUnique({
      where: { restaurantId_branchId: { restaurantId, branchId } },
      include: { departments: { orderBy: { dep: 'asc' } } },
    });
    if (!cfg) {
      return null;
    }
    return {
      restaurantId,
      branchId,
      crn: cfg.crn,
      cashierId: cfg.cashierId,
      environment: cfg.environment as 'PROD' | 'TEST',
      language: cfg.language,
      active: cfg.active,
      certConfigured: cfg.certCipher !== null,
      departments: cfg.departments.map((d) => ({
        dep: d.dep,
        taxRegime: d.taxRegime,
        label: d.label,
      })),
      lastCheckConnectionAt: cfg.lastCheckConnectionAt,
      lastCheckConnectionOk: cfg.lastCheckConnectionOk,
      updatedAt: cfg.updatedAt,
    };
  }

  async recordCheckConnection(restaurantId: string, branchId: string, ok: boolean): Promise<void> {
    await this.prisma.fiscalConfig.update({
      where: { restaurantId_branchId: { restaurantId, branchId } },
      data: { lastCheckConnectionAt: new Date(), lastCheckConnectionOk: ok },
    });
  }
}
