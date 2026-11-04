import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../../shared/infrastructure/config/env.schema';
import {
  extensionForContentType,
  isAllowedImageContentType,
} from '../../domain/media-content-type';
import {
  OBJECT_STORAGE_PORT,
  ObjectStoragePort,
  PresignedUpload,
} from '../ports/object-storage.port';
import { buildObjectKey, MediaTarget } from '../object-key';
import { NoRestaurantInScope, UnsupportedContentType } from '../media.errors';

export interface PresignUploadInput {
  /** From @CurrentTenant — the presign prefix is derived from this, never the client. */
  restaurantId: string | null;
  /** Which image field this upload is destined for (drives the key segment). */
  target: MediaTarget;
  /** Client-declared content-type; validated against the allowlist here. */
  contentType: string;
}

export interface PresignUploadResult extends PresignedUpload {
  /** Advisory max byte size the client should enforce before PUT. */
  maxBytes: number;
}

/**
 * Presign a direct-to-storage upload. Validates the content-type allowlist,
 * generates a tenant-scoped key SERVER-SIDE, and returns a presigned PUT URL.
 * The bytes never route through the API; a later finalize records the returned
 * key on the target entity.
 */
@Injectable()
export class PresignUploadUseCase {
  constructor(
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async execute(input: PresignUploadInput): Promise<PresignUploadResult> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    if (!isAllowedImageContentType(input.contentType)) {
      throw UnsupportedContentType(input.contentType);
    }
    const maxBytes = this.config.get('MEDIA_MAX_UPLOAD_BYTES', { infer: true });
    const key = buildObjectKey(
      input.restaurantId,
      input.target,
      extensionForContentType(input.contentType),
    );
    const presigned = await this.storage.presignUpload({
      key,
      contentType: input.contentType,
      maxBytes,
    });
    return { ...presigned, maxBytes };
  }
}
