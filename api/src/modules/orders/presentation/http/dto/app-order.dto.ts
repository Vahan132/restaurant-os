import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { QrCartLineDto } from '../../../application/dto/qr-order.dto';

/**
 * App ordering cart body. Same cart shape as QR-web, plus the scanned table `qr`:
 * the app has no `X-Session-Token`, so the branch + table are resolved server-side
 * from the QR (BR-4 — the table's owning branch), exactly like the QR-web open.
 * Server recomputes all pricing; the client never supplies prices or totals.
 */
export class AppCartDto {
  @ApiProperty({ description: 'The scanned table QR identifier (required).' })
  @IsString()
  @MinLength(1)
  qr!: string;

  @ApiProperty({ type: [QrCartLineDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QrCartLineDto)
  lines!: QrCartLineDto[];
}
