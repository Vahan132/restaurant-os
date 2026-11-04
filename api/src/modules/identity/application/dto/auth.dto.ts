import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'owner@demo.test' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'ChangeMe123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    description:
      '3A: ADMIN-surface device secret. Required for admin/manager login unless the caller is the Owner (break-glass) or the restaurant allows unanchored admin login.',
  })
  @IsOptional()
  @IsString()
  @MinLength(16)
  deviceSecret?: string;
}

export class RefreshDto {
  @ApiProperty({ description: 'A valid, non-revoked refresh token.' })
  @IsString()
  @MinLength(10)
  refreshToken!: string;
}

export class LogoutDto {
  @ApiProperty({ description: 'The refresh token to revoke.' })
  @IsString()
  @MinLength(10)
  refreshToken!: string;
}
