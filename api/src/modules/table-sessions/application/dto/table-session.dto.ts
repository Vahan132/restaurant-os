import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * QR-web open-or-join: only the scanned table QR is accepted. The channel is
 * forced to QR_WEB and the flow to PREPAYMENT server-side (never client-chosen).
 */
export class OpenQrTableSessionDto {
  @ApiProperty({ description: 'The scanned table QR identifier (required).' })
  @IsString()
  @MinLength(1)
  qr!: string;
}

/** QR-web table-session view lookup by scanned QR. */
export class QrTableSessionViewQuery {
  @ApiProperty({ description: 'The scanned table QR identifier (required).' })
  @IsString()
  @MinLength(1)
  qr!: string;
}
