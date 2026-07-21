import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../shared/infrastructure/config/env.schema';
import {
  FISCAL_CONFIG_PORT,
  FiscalConfigPort,
} from '../fiscalization/application/ports/fiscal-config.port';
import { EnvFileFiscalConfigAdapter } from '../fiscalization/infrastructure/config/env-file-fiscal-config.adapter';
import { FISCAL_CONFIG_STORE } from './application/ports/fiscal-config-store.port';
import { FISCAL_PRINT_MODE_READER } from './application/ports/fiscal-print-mode.reader';
import { TENANT_FISCAL_DEPARTMENT_READER } from './application/ports/tenant-fiscal-department.reader';
import { GetBranchFiscalDepartmentsUseCase } from './application/queries/get-branch-fiscal-departments.usecase';
import { DbFiscalConfigAdapter } from './infrastructure/adapters/db-fiscal-config.adapter';
import { FiscalCryptoService } from './infrastructure/crypto/fiscal-crypto.service';
import { PrismaFiscalConfigStore } from './infrastructure/persistence/prisma-fiscal-config.store';
import { PrismaFiscalPrintModeReader } from './infrastructure/persistence/prisma-fiscal-print-mode.reader';
import { PrismaTenantFiscalDepartmentReader } from './infrastructure/persistence/prisma-tenant-fiscal-department.reader';
import { TenantFiscalController } from './presentation/http/tenant-fiscal.controller';

/**
 * Fiscal-config module (FISCAL-4). Owns the encrypted per-tenant store + the
 * envelope crypto, and provides the FiscalConfigPort the e-HDM adapter reads.
 * `FISCAL_CONFIG_BACKEND` selects the backing: DB (cloud, encrypted store) or
 * FILE (edge/single-tenant, the FISCAL-1 env/file adapter). Exports the read port
 * (for FiscalizationModule) and the write/status store (for platform-admin).
 */
@Module({
  // FISCAL-DEPT-3A: the tenant-facing (restaurant-operator) non-secret departments
  // read. The platform-admin fiscal endpoints live in the platform module and are
  // untouched.
  controllers: [TenantFiscalController],
  providers: [
    FiscalCryptoService,
    DbFiscalConfigAdapter,
    EnvFileFiscalConfigAdapter,
    GetBranchFiscalDepartmentsUseCase,
    { provide: FISCAL_CONFIG_STORE, useClass: PrismaFiscalConfigStore },
    { provide: FISCAL_PRINT_MODE_READER, useClass: PrismaFiscalPrintModeReader },
    { provide: TENANT_FISCAL_DEPARTMENT_READER, useClass: PrismaTenantFiscalDepartmentReader },
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
  // EDGE-KEK-1: FiscalCryptoService is exported so the cloud edge read model can
  // re-wrap synced fiscal DEKs to a target hub's per-hub KEK (master KEK stays here).
  exports: [FISCAL_CONFIG_PORT, FISCAL_CONFIG_STORE, FISCAL_PRINT_MODE_READER, FiscalCryptoService],
})
export class FiscalConfigModule {}
