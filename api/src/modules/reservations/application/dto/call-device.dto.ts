import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { CallDevice } from '../../domain/entities/call-device';

export class RegisterCallDeviceDto {
  @ApiProperty({ description: 'Human-friendly device name (e.g. "Front desk phone").' })
  @IsString()
  @MinLength(1)
  name!: string;
}

export class CallDeviceResponse {
  @ApiProperty() id!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty({ nullable: true, type: String }) branchId!: string | null;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['ACTIVE', 'REVOKED'] }) status!: string;
  @ApiProperty({ nullable: true, type: String }) lastSeenAt!: string | null;
  @ApiProperty() createdByUserId!: string;
  @ApiProperty() createdAt!: string;

  static from(d: CallDevice): CallDeviceResponse {
    return {
      id: d.id,
      restaurantId: d.restaurantId,
      branchId: d.branchId,
      name: d.name,
      status: d.status,
      lastSeenAt: d.lastSeenAt ? d.lastSeenAt.toISOString() : null,
      createdByUserId: d.createdByUserId,
      createdAt: d.createdAt.toISOString(),
    };
  }
}

/** Registration response — includes the plaintext token EXACTLY once. */
export class RegisterCallDeviceResponse extends CallDeviceResponse {
  @ApiProperty({ description: 'Plaintext device token. Shown once; store it now.' })
  token!: string;

  static fromDevice(d: CallDevice, token: string): RegisterCallDeviceResponse {
    return { ...CallDeviceResponse.from(d), token };
  }
}
