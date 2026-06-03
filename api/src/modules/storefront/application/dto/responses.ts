import { ApiProperty } from '@nestjs/swagger';

export class PublicRestaurantResponse {
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: String }) logoUrl!: string | null;
  @ApiProperty() currency!: string;
  @ApiProperty() defaultLanguage!: string;
  @ApiProperty({ type: [String], example: ['hy', 'ru', 'en'] }) supportedLanguages!: string[];
  @ApiProperty() timezone!: string;
  @ApiProperty({ nullable: true, type: String }) address!: string | null;
  @ApiProperty({ nullable: true, type: String }) phone!: string | null;
  @ApiProperty({ nullable: true, type: Object }) openingHours!: unknown | null;
  @ApiProperty({ description: 'enableQrMenu && enableCustomerOrdering.' })
  orderingEnabled!: boolean;
}

export class PublicModifierOptionResponse {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ description: 'Price delta in minor units.' }) priceDeltaAmount!: number;
}
export class PublicModifierGroupResponse {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['SINGLE', 'MULTIPLE'] }) selectionType!: string;
  @ApiProperty() required!: boolean;
  @ApiProperty({ nullable: true, type: Number }) minSelect!: number | null;
  @ApiProperty({ nullable: true, type: Number }) maxSelect!: number | null;
  @ApiProperty({ type: [PublicModifierOptionResponse] }) options!: PublicModifierOptionResponse[];
}
export class PublicMenuItemResponse {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
  @ApiProperty({ description: 'Price in minor units.' }) priceAmount!: number;
  @ApiProperty({ nullable: true, type: String }) imageUrl!: string | null;
  @ApiProperty({ description: 'false = shown but currently unavailable.' }) available!: boolean;
  @ApiProperty({ type: [PublicModifierGroupResponse] })
  modifierGroups!: PublicModifierGroupResponse[];
}
export class PublicMenuCategoryResponse {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
  @ApiProperty({ type: [PublicMenuItemResponse] }) items!: PublicMenuItemResponse[];
}
export class PublicMenuResponse {
  @ApiProperty({ type: [PublicMenuCategoryResponse] }) categories!: PublicMenuCategoryResponse[];
}

export class PublicTableResponse {
  @ApiProperty() tableId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: String }) floorName!: string | null;
}
