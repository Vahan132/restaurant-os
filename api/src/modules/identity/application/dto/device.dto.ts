import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { DeviceSurface } from '../../domain/entities/device';

export class EnrollDeviceDto {
  @ApiProperty({ enum: DeviceSurface, description: 'Surface this device serves.' })
  @IsEnum(DeviceSurface)
  surface!: DeviceSurface;

  @ApiProperty({ example: 'Front counter POS', minLength: 1, maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label!: string;
}

export class PinLoginDto {
  @ApiProperty({ description: 'The enrolled device secret (POS/KDS).' })
  @IsString()
  @MinLength(16)
  deviceSecret!: string;

  @ApiProperty({ description: 'The user chosen from the branch staff picker.' })
  @IsString()
  @MinLength(1)
  userId!: string;

  @ApiProperty({ example: '0184 27', description: '6-digit PIN.' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'PIN must be exactly 6 digits.' })
  pin!: string;
}
