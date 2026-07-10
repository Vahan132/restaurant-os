import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import { AppConfig } from '../../../../shared/infrastructure/config/env.schema';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { resolveBaseUrl } from '../../../fiscalization/application/ehdm-protocol';
import { FatalFiscalError } from '../../../fiscalization/application/ports/fiscal-errors';
import {
  FiscalConfigPort,
  TenantFiscalConfig,
} from '../../../fiscalization/application/ports/fiscal-config.port';
import { FiscalCryptoService } from '../crypto/fiscal-crypto.service';

/**
 * DB-backed FiscalConfigPort (FISCAL-4). Drop-in for FISCAL-1's env/file backing:
 * reads the per-tenant row, unwraps the envelope-encrypted cert/key, builds the
 * `departmentMap` (dep -> tax regime) the adapter's line mapping reads, and
 * resolves the shared SRC CA (public, from FISCAL_SRC_CA_PATH). An absent/inactive
 * config ⇒ FatalFiscalError (fail closed). Decrypted buffers are returned ONLY on
 * this adapter-facing type — never on any HTTP read model.
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
    const { cert, key } = this.crypto.unwrap({
      cert: { cipher: cfg.certCipher, iv: cfg.certIv, authTag: cfg.certAuthTag },
      key: { cipher: cfg.keyCipher, iv: cfg.keyIv, authTag: cfg.keyAuthTag },
      dek: { cipher: cfg.dekCipher, iv: cfg.dekIv, authTag: cfg.dekAuthTag },
      kekVersion: cfg.kekVersion,
    });
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
