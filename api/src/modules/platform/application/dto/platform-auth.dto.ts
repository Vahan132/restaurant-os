import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class PlatformLoginDto {
  @ApiProperty({ example: 'admin@platform.test' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'AdminPass123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class PlatformRefreshDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  refreshToken!: string;
}

export class PlatformLogoutDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  refreshToken!: string;
}
