import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import { AppConfig } from '../../../../shared/infrastructure/config/env.schema';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { resolveBaseUrl } from '../../../fiscalization/application/ehdm-protocol';
import { FatalFiscalError } from '../../../fiscalization/application/ports/fiscal-errors';
import {
  FiscalConfigPort,
  FiscalDeviceConfig,
  TenantFiscalConfig,
} from '../../../fiscalization/application/ports/fiscal-config.port';
import { FiscalCryptoService } from '../crypto/fiscal-crypto.service';

/**
 * DB-backed FiscalConfigPort (FISCAL-4). Drop-in for the env/file backing. Reads
 * the per-tenant row, unwraps the envelope-encrypted cert/key, builds the
 * `departmentMap` (dep -> tax regime), and resolves the shared SRC CA. Fails
 * closed when the config is absent, inactive, OR active-but-cert-not-yet-uploaded.
 * Decrypted buffers are returned ONLY on this adapter-facing type — never on any
 * HTTP read model.
 */
@Injectable()
export class DbFiscalConfigAdapter implements FiscalConfigPort {
  private caCache: Buffer | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: FiscalCryptoService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async getConfig(restaurantId: string, branchId: string): Promise<TenantFiscalConfig> {
    const cfg = await this.prisma.fiscalConfig.findUnique({
      where: { restaurantId_branchId: { restaurantId, branchId } },
      include: { departments: true },
    });
    if (!cfg || !cfg.active) {
      throw new FatalFiscalError(
        'FISCAL_CONFIG_MISSING',
        `No active e-HDM config for ${restaurantId}:${branchId}.`,
      );
    }
    const {
      certCipher, certIv, certAuthTag,
      keyCipher, keyIv, keyAuthTag,
      dekCipher, dekIv, dekAuthTag,
    } = cfg;
    if (
      !certCipher || !certIv || !certAuthTag ||
      !keyCipher || !keyIv || !keyAuthTag ||
      !dekCipher || !dekIv || !dekAuthTag
    ) {
      throw new FatalFiscalError(
        'FISCAL_CERT_MISSING',
        `e-HDM config for ${restaurantId}:${branchId} has no cert uploaded.`,
      );
    }
    // Unwrap the per-row DEK ONCE (fails closed at GCM verify if the hub's
    // FISCAL_MASTER_KEK doesn't match the one the cloud wrapped with), then open
    // cert, key AND — when present — the physical-device password under it.
    const dek = this.crypto.unwrapDek({ cipher: dekCipher, iv: dekIv, authTag: dekAuthTag });
    const cert = this.crypto.openUnderDek(dek, {
      cipher: certCipher, iv: certIv, authTag: certAuthTag,
    });
    const key = this.crypto.openUnderDek(dek, {
      cipher: keyCipher, iv: keyIv, authTag: keyAuthTag,
    });

    // FISCAL-EDGE-1: optional physical device (shares the row DEK above).
    const device = this.openDevice(cfg, dek) ?? undefined;

    const departmentMap: Record<string, string> = {};
    for (const d of cfg.departments) {
      departmentMap[d.dep] = d.taxRegime;
    }
    const environment = cfg.environment as 'PROD' | 'TEST';
    return {
      crn: cfg.crn,
      cashierId: cfg.cashierId,
      environment,
      baseUrl: resolveBaseUrl(environment),
      clientCert: cert,
      clientKey: key,
      caRoot: this.caRoot(),
      language: cfg.language as 'hy' | 'en' | 'ru',
      departmentMap,
      ...(device ? { device } : {}),
    };
  }

  /**
   * HDM-TM-1: physical-device config only. Needs an ACTIVE row + device + DEK, but
   * NOT the e-HDM cert/key (a TouchMaster-only branch has none).
   */
  async getDeviceConfig(restaurantId: string, branchId: string): Promise<FiscalDeviceConfig> {
    const cfg = await this.prisma.fiscalConfig.findUnique({
      where: { restaurantId_branchId: { restaurantId, branchId } },
    });
    const notConfigured = (): FatalFiscalError =>
      new FatalFiscalError(
        'DEVICE_NOT_CONFIGURED',
        `No active physical HDM device configured for ${restaurantId}:${branchId}.`,
      );
    if (!cfg || !cfg.active || !cfg.dekCipher || !cfg.dekIv || !cfg.dekAuthTag) {
      throw notConfigured();
    }
    const dek = this.crypto.unwrapDek({
      cipher: cfg.dekCipher,
      iv: cfg.dekIv,
      authTag: cfg.dekAuthTag,
    });
    const device = this.openDevice(cfg, dek);
    if (!device) {
      throw notConfigured();
    }
    return device;
  }

  /** Decrypt the device password (+ optional PIN) under the row DEK, or null. */
  private openDevice(
    cfg: {
      deviceHost: string | null;
      devicePort: number | null;
      devicePwdCipher: Buffer | null;
      devicePwdIv: Buffer | null;
      devicePwdAuthTag: Buffer | null;
      deviceCashierId: number | null;
      devicePinCipher: Buffer | null;
      devicePinIv: Buffer | null;
      devicePinAuthTag: Buffer | null;
      deviceUseExtPos: boolean;
    },
    dek: Buffer,
  ): FiscalDeviceConfig | null {
    const { deviceHost, devicePort, devicePwdCipher, devicePwdIv, devicePwdAuthTag } = cfg;
    if (
      deviceHost === null ||
      devicePort === null ||
      !devicePwdCipher ||
      !devicePwdIv ||
      !devicePwdAuthTag
    ) {
      return null;
    }
    const password = this.crypto
      .openUnderDek(dek, { cipher: devicePwdCipher, iv: devicePwdIv, authTag: devicePwdAuthTag })
      .toString('utf8');
    const pin =
      cfg.devicePinCipher && cfg.devicePinIv && cfg.devicePinAuthTag
        ? this.crypto
            .openUnderDek(dek, {
              cipher: cfg.devicePinCipher,
              iv: cfg.devicePinIv,
              authTag: cfg.devicePinAuthTag,
            })
            .toString('utf8')
        : null;
    return {
      host: deviceHost,
      port: devicePort,
      password,
      cashierId: cfg.deviceCashierId,
      pin,
      useExtPos: cfg.deviceUseExtPos,
    };
  }

  /** Shared SRC public CA (PEM) — same for every tenant, not a secret. */
  private caRoot(): Buffer {
    if (this.caCache) {
      return this.caCache;
    }
    const path = this.config.get('FISCAL_SRC_CA_PATH', { infer: true }) as string | undefined;
    if (!path) {
      throw new FatalFiscalError('FISCAL_CA_MISSING', 'FISCAL_SRC_CA_PATH is not configured.');
    }
    this.caCache = fs.readFileSync(path);
    return this.caCache;
  }
}
