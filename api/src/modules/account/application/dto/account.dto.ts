import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../../../shared/application/pagination';

export class SignupDto {
  @ApiProperty() @IsString() @MinLength(1) ownerName!: string;
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) password!: string;
  @ApiProperty() @IsString() @MinLength(1) businessName!: string;
  @ApiProperty() @IsString() @MinLength(1) planCode!: string;
  @ApiProperty() @IsString() @MinLength(1) restaurantName!: string;
  @ApiProperty({ description: 'Desired subdomain (a-z0-9-, 3–63).' }) @IsString() slug!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() defaultLanguage?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() timezone?: string;
}

export class ChangePlanDto {
  @ApiProperty() @IsString() @MinLength(1) planCode!: string;
}

export class UpdateAccountProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) fullName?: string;
}

export class UpdateBillingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() billingName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() billingEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() billingAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() taxId?: string;
}

export class HistoryQuery {
  @ApiPropertyOptional({ default: DEFAULT_PAGE, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = DEFAULT_PAGE;

  @ApiPropertyOptional({ default: DEFAULT_LIMIT, minimum: 1, maximum: MAX_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit: number = DEFAULT_LIMIT;
}
