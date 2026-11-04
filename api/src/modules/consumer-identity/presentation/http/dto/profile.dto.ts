import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsISO8601, IsOptional, IsString, Length, MaxLength } from 'class-validator';

const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED'] as const;

/**
 * Whitelisted profile patch. `email` is accepted by validation purely so the
 * use-case can reject it with EMAIL_IMMUTABLE (rather than a generic
 * VALIDATION_ERROR from forbidNonWhitelisted). name/gender/birthday are editable;
 * sending null clears the field.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string | null;

  @ApiPropertyOptional({ enum: GENDERS, nullable: true })
  @IsOptional()
  @IsIn(GENDERS as unknown as string[])
  gender?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, description: 'ISO date (YYYY-MM-DD).' })
  @IsOptional()
  @IsISO8601()
  birthday?: string | null;

  @ApiPropertyOptional({
    type: String,
    description: 'Provider-owned; any value is rejected (EMAIL_IMMUTABLE).',
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class RequestPhoneChangeDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(24)
  newPhone!: string;

  @ApiPropertyOptional({ description: 'SMS locale: hy | ru | en.' })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  locale?: string;
}

export class ConfirmPhoneChangeDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(24)
  newPhone!: string;

  @ApiPropertyOptional()
  @IsString()
  @Length(4, 8)
  code!: string;
}
