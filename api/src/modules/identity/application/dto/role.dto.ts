import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'Shift Lead' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'SHIFT_LEAD', description: 'Unique code within the org (UPPER_SNAKE).' })
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]*$/, { message: 'code must be UPPER_SNAKE_CASE' })
  @MaxLength(50)
  code!: string;

  @ApiProperty({
    type: [String],
    example: ['DASHBOARD_VIEW', 'ORDER_CREATE'],
    description: 'Permission keys; validated against the catalog.',
  })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions!: string[];
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'Senior Shift Lead' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['DASHBOARD_VIEW', 'ORDER_CREATE', 'ORDER_EDIT'],
    description: 'Replaces the full permission set; validated against the catalog.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions?: string[];
}
