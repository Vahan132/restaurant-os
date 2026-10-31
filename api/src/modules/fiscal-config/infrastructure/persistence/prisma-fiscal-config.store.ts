import { BadRequestException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  FiscalConfigStatus,
  FiscalConfigStore,
  FiscalDepartmentInput,
  SetFiscalCertInput,
  SetFiscalDeviceInput,
  UpsertFiscalConfigInput,
} from '../../application/ports/fiscal-config-store.port';
import { FiscalPrintMode } from '../../application/ports/fiscal-print-mode.reader';
import { CURRENT_KEK_VERSION, FiscalCryptoService } from '../crypto/fiscal-crypto.service';

/** Config not found for the given branch (a cert/department write before upsert). */
export class FiscalConfigNotFoundError extends Error {
  constructor(restaurantId: string, branchId: string) {
    super(`No fiscal config for ${restaurantId}:${branchId}.`);
    this.name = 'FiscalConfigNotFoundError';
  }
}

/** HDM-TM-1: the first device setup must include the device password. */
export class FiscalDevicePasswordRequiredError extends BadRequestException {
  constructor() {
    super({
      code: 'FISCAL_DEVICE_PASSWORD_REQUIRED',
      message: 'Enter the HDM integration password (set on the device) for the first setup.',
    });
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
    const row = await this.prisma.fiscalConfig.findUnique({
      where: {
        restaurantId_branchId: { restaurantId: input.restaurantId, branchId: input.branchId },
      },
      select: { id: true, dekCipher: true, dekIv: true, dekAuthTag: true },
    });
    if (!row) {
      throw new FiscalConfigNotFoundError(input.restaurantId, input.branchId);
    }
    // Reuse the row's DEK if one already exists (e.g. a device password was set
    // first) so cert/key/device-password all share ONE DEK; else mint a fresh one.
    const { dek, dekColumns } = this.resolveRowDek(row);
    const cert = this.crypto.sealUnderDek(dek, Buffer.from(input.clientCertPem, 'utf8'));
    const key = this.crypto.sealUnderDek(dek, Buffer.from(input.clientKeyPem, 'utf8'));
    await this.prisma.fiscalConfig.update({
      where: {
        restaurantId_branchId: { restaurantId: input.restaurantId, branchId: input.branchId },
      },
      data: {
        certCipher: cert.cipher,
        certIv: cert.iv,
        certAuthTag: cert.authTag,
        keyCipher: key.cipher,
        keyIv: key.iv,
        keyAuthTag: key.authTag,
        ...dekColumns,
      },
    });
  }

  async setDevice(input: SetFiscalDeviceInput): Promise<void> {
    const row = await this.prisma.fiscalConfig.findUnique({
      where: {
        restaurantId_branchId: { restaurantId: input.restaurantId, branchId: input.branchId },
      },
      select: {
        id: true,
        dekCipher: true,
        dekIv: true,
        dekAuthTag: true,
        devicePwdCipher: true,
      },
    });
    if (!row) {
      throw new FiscalConfigNotFoundError(input.restaurantId, input.branchId);
    }
    const newPassword = input.devicePassword?.trim() ? input.devicePassword : null;
    const newPin = input.devicePin?.trim() ? input.devicePin.trim() : null;
    // A first-time device setup must carry the password (write-only, kept if blank later).
    if (!newPassword && row.devicePwdCipher === null) {
      throw new FiscalDevicePasswordRequiredError();
    }
    // Shared DEK: the device password/PIN are sealed under the SAME DEK as cert/key
    // (reused if present, minted here if the device is configured before a cert).
    const { dek, dekColumns } = this.resolveRowDek(row);
    const pwd = newPassword ? this.crypto.sealUnderDek(dek, Buffer.from(newPassword, 'utf8')) : null;
    const pin = newPin ? this.crypto.sealUnderDek(dek, Buffer.from(newPin, 'utf8')) : null;
    await this.prisma.fiscalConfig.update({
      where: {
        restaurantId_branchId: { restaurantId: input.restaurantId, branchId: input.branchId },
      },
      data: {
        deviceHost: input.deviceHost,
        devicePort: input.devicePort,
        ...(pwd
          ? { devicePwdCipher: pwd.cipher, devicePwdIv: pwd.iv, devicePwdAuthTag: pwd.authTag }
          : {}),
        ...(input.deviceCashierId !== undefined ? { deviceCashierId: input.deviceCashierId } : {}),
        ...(pin
          ? { devicePinCipher: pin.cipher, devicePinIv: pin.iv, devicePinAuthTag: pin.authTag }
          : {}),
        ...(input.deviceUseExtPos !== undefined ? { deviceUseExtPos: input.deviceUseExtPos } : {}),
        ...dekColumns,
      },
    });
  }

  async setPrintMode(
    restaurantId: string,
    branchId: string,
    mode: FiscalPrintMode,
  ): Promise<void> {
    const exists = await this.prisma.fiscalConfig.findUnique({
      where: { restaurantId_branchId: { restaurantId, branchId } },
      select: { id: true },
    });
    if (!exists) {
      throw new FiscalConfigNotFoundError(restaurantId, branchId);
    }
    await this.prisma.fiscalConfig.update({
      where: { restaurantId_branchId: { restaurantId, branchId } },
      data: { fiscalPrintMode: mode },
    });
  }

  /**
   * Resolve the per-row DEK. Reuses the existing wrapped DEK when present (so all
   * of cert/key/device-password share one DEK); otherwise mints a fresh DEK and
   * returns the dek/kekVersion columns to persist. When the DEK is reused,
   * `dekColumns` is empty so the existing columns are left untouched.
   */
  private resolveRowDek(row: {
    dekCipher: Buffer | null;
    dekIv: Buffer | null;
    dekAuthTag: Buffer | null;
  }): {
    dek: Buffer;
    dekColumns: {
      dekCipher?: Buffer;
      dekIv?: Buffer;
      dekAuthTag?: Buffer;
      kekVersion?: number;
    };
  } {
    if (row.dekCipher && row.dekIv && row.dekAuthTag) {
      const dek = this.crypto.unwrapDek({
        cipher: row.dekCipher,
        iv: row.dekIv,
        authTag: row.dekAuthTag,
      });
      return { dek, dekColumns: {} };
    }
    const dek = this.crypto.generateDek();
    const wrapped = this.crypto.wrapDek(dek);
    return {
      dek,
      dekColumns: {
        dekCipher: wrapped.cipher,
        dekIv: wrapped.iv,
        dekAuthTag: wrapped.authTag,
        kekVersion: CURRENT_KEK_VERSION,
      },
    };
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
      deviceHost: cfg.deviceHost,
      devicePort: cfg.devicePort,
      deviceConfigured: cfg.devicePwdCipher !== null,
      deviceCashierId: cfg.deviceCashierId,
      devicePinConfigured: cfg.devicePinCipher !== null,
      deviceUseExtPos: cfg.deviceUseExtPos,
      fiscalPrintMode: cfg.fiscalPrintMode as FiscalPrintMode,
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
