import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';

export class ProvisionOrgDto {
  @ApiProperty({ example: 'Acme Restaurants' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 'acme' })
  @IsString()
  @MinLength(1)
  slug!: string;
}

export class ProvisionRestaurantDto {
  @ApiProperty({ example: 'Acme Downtown' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 'acme-downtown', description: 'Unique subdomain slug.' })
  @IsString()
  @MinLength(1)
  slug!: string;

  @ApiProperty({ example: 'USD' })
  @IsString()
  @MinLength(3)
  currency!: string;

  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  defaultLanguage?: string;

  @ApiPropertyOptional({ example: 'America/New_York' })
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class ProvisionOwnerDto {
  @ApiProperty({ example: 'Alice Owner' })
  @IsString()
  @MinLength(1)
  fullName!: string;

  @ApiProperty({ example: 'alice@acme.test' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({
    description: 'Optional. If omitted, a strong password is generated and returned once.',
    minLength: 8,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}

export class ProvisionOrganizationDto {
  @ApiProperty({ type: ProvisionOrgDto })
  @ValidateNested()
  @Type(() => ProvisionOrgDto)
  org!: ProvisionOrgDto;

  @ApiProperty({ example: 'starter' })
  @IsString()
  @MinLength(1)
  planCode!: string;

  @ApiProperty({ type: ProvisionRestaurantDto })
  @ValidateNested()
  @Type(() => ProvisionRestaurantDto)
  restaurant!: ProvisionRestaurantDto;

  @ApiProperty({ type: ProvisionOwnerDto })
  @ValidateNested()
  @Type(() => ProvisionOwnerDto)
  owner!: ProvisionOwnerDto;
}
