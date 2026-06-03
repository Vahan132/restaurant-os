import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';
import { AppConfig, validateEnv } from './env.schema';

/**
 * Global config module. Wraps @nestjs/config with zod validation (fail-fast).
 * Inject `ConfigService<AppConfig, true>` anywhere to read typed config.
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService, NestConfigModule],
})
export class AppConfigModule {}

/** Convenience alias for typed ConfigService injection. */
export type TypedConfigService = ConfigService<AppConfig, true>;
