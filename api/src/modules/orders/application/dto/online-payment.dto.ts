import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { StartOnlinePaymentResult } from '../commands/start-online-payment.usecase';

/** PAYNET-1: begin a hosted-checkout payment for a QR prepayment order. */
export class StartOnlinePaymentDto {
  @ApiProperty({ description: 'Absolute URL of the customer page Paynet returns the buyer to.' })
  @IsString()
  @MaxLength(2000)
  returnUrl!: string;
}

export class StartOnlinePaymentResponse {
  @ApiProperty({ enum: ['REDIRECT', 'CONFIRM'] })
  mode!: 'REDIRECT' | 'CONFIRM';
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Set when mode = REDIRECT.' })
  checkoutUrl!: string | null;

  static from(r: StartOnlinePaymentResult): StartOnlinePaymentResponse {
    const out = new StartOnlinePaymentResponse();
    out.mode = r.mode;
    out.checkoutUrl = r.mode === 'REDIRECT' ? r.checkoutUrl : null;
    return out;
  }
}
