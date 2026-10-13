import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../shared/infrastructure/config/env.schema';
import { PresignUploadUseCase } from './application/commands/presign-upload.usecase';
import { OBJECT_STORAGE_PORT, ObjectStoragePort } from './application/ports/object-storage.port';
import { DevObjectStorageAdapter } from './infrastructure/adapters/dev-object-storage.adapter';
import { R2ObjectStorageAdapter } from './infrastructure/adapters/r2-object-storage.adapter';
import { MediaController } from './presentation/http/media.controller';
import { MediaDevController } from './presentation/http/media-dev.controller';

/**
 * Media module — defines the ObjectStoragePort seam and binds the adapter chosen
 * by STORAGE_DRIVER (r2 | dev). The factory constructs ONLY the selected adapter,
 * so a dev app never touches R2 env and vice-versa. Exports OBJECT_STORAGE_PORT
 * so the menu / restaurant / consumer modules can resolve keys → public URLs at
 * finalize. Mirrors FiscalizationModule / PaymentModule.
 */
@Module({
  controllers: [MediaController, MediaDevController],
  providers: [
    PresignUploadUseCase,
    {
      provide: OBJECT_STORAGE_PORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): ObjectStoragePort =>
        config.get('STORAGE_DRIVER', { infer: true }) === 'r2'
          ? new R2ObjectStorageAdapter(config)
          : new DevObjectStorageAdapter(config),
    },
  ],
  exports: [OBJECT_STORAGE_PORT],
})
export class MediaModule {}
