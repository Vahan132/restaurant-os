import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../shared/infrastructure/config/env.schema';
import {
  FISCAL_CONFIG_PORT,
  FiscalConfigPort,
} from '../fiscalization/application/ports/fiscal-config.port';
import { EnvFileFiscalConfigAdapter } from '../fiscalization/infrastructure/config/env-file-fiscal-config.adapter';
import { FISCAL_CONFIG_STORE } from './application/ports/fiscal-config-store.port';
import { DbFiscalConfigAdapter } from './infrastructure/adapters/db-fiscal-config.adapter';
import { FiscalCryptoService } from './infrastructure/crypto/fiscal-crypto.service';
import { PrismaFiscalConfigStore } from './infrastructure/persistence/prisma-fiscal-config.store';

/**
 * Fiscal-config module (FISCAL-4). Owns the encrypted per-tenant store + the
 * envelope crypto, and provides the FiscalConfigPort the e-HDM adapter reads.
 * `FISCAL_CONFIG_BACKEND` selects the backing: DB (cloud, encrypted store) or
 * FILE (edge/single-tenant, the FISCAL-1 env/file adapter). Exports the read port
 * (for FiscalizationModule) and the write/status store (for platform-admin).
 */
@Module({
  providers: [
    FiscalCryptoService,
    DbFiscalConfigAdapter,
    EnvFileFiscalConfigAdapter,
    { provide: FISCAL_CONFIG_STORE, useClass: PrismaFiscalConfigStore },
    {
      provide: FISCAL_CONFIG_PORT,
      useFactory: (
        config: ConfigService<AppConfig, true>,
        dbAdapter: DbFiscalConfigAdapter,
        fileAdapter: EnvFileFiscalConfigAdapter,
      ): FiscalConfigPort =>
        config.get('FISCAL_CONFIG_BACKEND', { infer: true }) === 'DB' ? dbAdapter : fileAdapter,
      inject: [ConfigService, DbFiscalConfigAdapter, EnvFileFiscalConfigAdapter],
    },
  ],
  exports: [FISCAL_CONFIG_PORT, FISCAL_CONFIG_STORE],
})
export class FiscalConfigModule {}
