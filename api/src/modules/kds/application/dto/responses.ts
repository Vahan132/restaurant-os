import { ApiProperty } from '@nestjs/swagger';

export class KdsTicketModifierResponse {
  @ApiProperty() name!: string;
  @ApiProperty() priceDelta!: number;
}

export class KdsTicketItemResponse {
  @ApiProperty() orderItemId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty({ type: [KdsTicketModifierResponse] }) modifiers!: KdsTicketModifierResponse[];
  @ApiProperty({ nullable: true, type: String }) note!: string | null;
  @ApiProperty({ enum: ['SENT', 'PREPARING', 'READY'] }) status!: string;
  @ApiProperty() sentToKitchenAt!: string;
  @ApiProperty({ nullable: true, type: Number }) prepTimeMinutes!: number | null;
  @ApiProperty({ description: 'Seconds since the item was sent to the kitchen.' })
  elapsedSeconds!: number;
  @ApiProperty({ description: 'elapsed > prepTime*60 (or > 900s when no estimate).' })
  delayed!: boolean;
}

export class KdsTicketResponse {
  @ApiProperty() orderId!: string;
  @ApiProperty() orderNumber!: number;
  @ApiProperty({ nullable: true, type: String }) tableName!: string | null;
  @ApiProperty({ nullable: true, type: String }) waiterName!: string | null;
  @ApiProperty({ nullable: true, type: String }) orderNote!: string | null;
  @ApiProperty({ type: [KdsTicketItemResponse] }) items!: KdsTicketItemResponse[];
}
