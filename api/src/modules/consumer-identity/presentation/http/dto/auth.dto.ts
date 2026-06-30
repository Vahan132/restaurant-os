import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class GoogleSignInDto {
  @ApiProperty({ description: 'Google ID token obtained natively by the app.' })
  @IsString()
  @MinLength(1)
  idToken!: string;
}

export class AppleSignInDto {
  @ApiProperty({ description: 'Apple identity token obtained natively by the app.' })
  @IsString()
  @MinLength(1)
  idToken!: string;

  @ApiPropertyOptional({ description: 'Name captured on the FIRST Apple authorization.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  firstAuthName?: string;

  @ApiPropertyOptional({ description: 'Email captured on the FIRST Apple authorization.' })
  @IsOptional()
  @IsEmail()
  firstAuthEmail?: string;
}

export class RequestOtpDto {
  @ApiProperty({ description: 'Recipient phone (E.164 or light formatting).' })
  @IsString()
  @MaxLength(24)
  phone!: string;

  @ApiPropertyOptional({ description: 'SMS locale: hy | ru | en.' })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  locale?: string;
}

export class VerifyOtpDto {
  @ApiProperty()
  @IsString()
  @MaxLength(24)
  phone!: string;

  @ApiProperty({ description: 'The OTP code from the SMS.' })
  @IsString()
  @Length(4, 8)
  code!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  refreshToken!: string;
}

export class SignOutDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  refreshToken!: string;
}
