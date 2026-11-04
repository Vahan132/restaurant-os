import { ApiProperty } from '@nestjs/swagger';

export class ConsumerSessionResponse {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ description: 'Opaque rotating refresh token (store securely).' })
  refreshToken!: string;

  @ApiProperty({ enum: ['Bearer'], default: 'Bearer' })
  tokenType!: 'Bearer';

  @ApiProperty({ description: 'Access token lifetime in seconds.' })
  expiresIn!: number;
}

export class ConsumerProfileResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true, type: String })
  name!: string | null;

  @ApiProperty({ nullable: true, type: String })
  email!: string | null;

  @ApiProperty({ nullable: true, type: String })
  phone!: string | null;

  @ApiProperty({ nullable: true, type: String, enum: ['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED'] })
  gender!: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'ISO date (YYYY-MM-DD).' })
  birthday!: string | null;
}

/** Generic 200 body for actions that must not leak result detail (OTP request, etc.). */
export class AcknowledgementResponse {
  @ApiProperty({ default: true })
  success!: boolean;
}
