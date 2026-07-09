import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import { AppConfig } from '../../../../shared/infrastructure/config/env.schema';
import { FatalFiscalError } from '../../application/ports/fiscal-errors';
import {
  FiscalConfigPort,
  FiscalEnvironment,
  FiscalLanguage,
  TenantFiscalConfig,
} from '../../application/ports/fiscal-config.port';
import { resolveBaseUrl } from '../../application/ehdm-protocol';

/** One tenant entry in the JSON config file (paths point to PEM secrets on disk). */
interface RawTenantEntry {
  crn: string;
  cashierId: string;
  environment: FiscalEnvironment;
  certPath: string;
  keyPath: string;
  caPath: string;
  language?: FiscalLanguage;
  departmentMap?: Record<string, string>;
}

interface RawFiscalConfigFile {
  tenants: Record<string, RawTenantEntry>;
}

/**
 * FISCAL-1 env/file-backed FiscalConfigPort (decision D — mirrors the edge
 * SnapshotClient config-read pattern). `FISCAL_CONFIG_PATH` points to a JSON file
 * keyed by "<restaurantId>:<branchId>"; per-tenant SECRETS are the PEM files it
 * references (converted from `.jks` by ops), NOT the global env schema. Missing
 * path or tenant ⇒ FatalFiscalError (fail closed, no retry loop). FISCAL-4 swaps
 * this for a DB + secret store + admin UI behind the same port.
 */
@Injectable()
export class EnvFileFiscalConfigAdapter implements FiscalConfigPort {
  private cache: Record<string, RawTenantEntry> | null = null;

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  getConfig(restaurantId: string, branchId: string): Promise<TenantFiscalConfig> {
    const path = this.config.get('FISCAL_CONFIG_PATH', { infer: true }) as string | undefined;
    if (!path) {
      throw new FatalFiscalError(
        'FISCAL_CONFIG_MISSING',
        'e-HDM is not configured (FISCAL_CONFIG_PATH unset).',
      );
    }
    const tenants = this.load(path);
    const raw = tenants[`${restaurantId}:${branchId}`];
    if (!raw) {
      throw new FatalFiscalError(
        'FISCAL_CONFIG_MISSING',
        `No e-HDM config for ${restaurantId}:${branchId}.`,
      );
    }
    return Promise.resolve({
      crn: raw.crn,
      cashierId: raw.cashierId,
      environment: raw.environment,
      baseUrl: resolveBaseUrl(raw.environment),
      clientCert: fs.readFileSync(raw.certPath),
      clientKey: fs.readFileSync(raw.keyPath),
      caRoot: fs.readFileSync(raw.caPath),
      language: raw.language ?? 'hy',
      departmentMap: raw.departmentMap ?? {},
    });
  }

  private load(path: string): Record<string, RawTenantEntry> {
    if (this.cache === null) {
      const parsed = JSON.parse(fs.readFileSync(path, 'utf8')) as RawFiscalConfigFile;
      this.cache = parsed.tenants ?? {};
    }
    return this.cache;
  }
}
