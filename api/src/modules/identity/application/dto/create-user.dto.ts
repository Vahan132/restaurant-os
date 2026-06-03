import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * NOTE: there is intentionally NO `organizationId` field. The organization is
 * ALWAYS taken from the authenticated tenant context, never from the body.
 * (The global ValidationPipe also rejects unknown fields.)
 */
export class CreateUserDto {
  @ApiProperty({ example: 'jane@demo.test' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPass123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName!: string;

  @ApiProperty({ description: 'Role id (must belong to the same organization).' })
  @IsString()
  @MinLength(1)
  roleId!: string;

  @ApiPropertyOptional({
    description: 'Restaurant scope. Omit/null = organization-wide user.',
  })
  @IsOptional()
  @IsString()
  restaurantId?: string;

  @ApiPropertyOptional({ description: 'Optional branch scope within the restaurant.' })
  @IsOptional()
  @IsString()
  branchId?: string;
}
