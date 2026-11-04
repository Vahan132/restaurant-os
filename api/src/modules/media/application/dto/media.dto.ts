import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { PresignUploadResult } from '../commands/presign-upload.usecase';

export class PresignUploadDto {
  @ApiProperty({
    description: 'Image MIME type. Allowed: image/jpeg, image/png, image/webp.',
    example: 'image/jpeg',
  })
  @IsString()
  contentType!: string;
}

export class PresignUploadResponse {
  @ApiProperty({ description: 'Presigned PUT URL — upload the bytes here directly.' })
  url!: string;

  @ApiProperty({ description: 'Server-generated object key to send back at finalize.' })
  key!: string;

  @ApiProperty({ description: 'ISO timestamp after which the URL is invalid.' })
  expiresAt!: string;

  @ApiProperty({ description: 'Advisory max upload size in bytes.' })
  maxBytes!: number;

  static from(r: PresignUploadResult): PresignUploadResponse {
    return {
      url: r.url,
      key: r.key,
      expiresAt: r.expiresAt.toISOString(),
      maxBytes: r.maxBytes,
    };
  }
}
