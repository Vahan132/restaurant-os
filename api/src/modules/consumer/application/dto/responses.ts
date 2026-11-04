import { ApiProperty } from '@nestjs/swagger';

/** i18n text serialized in the consumer shape: { hy, ru, en }. */
export class I18nTextResponse {
  @ApiProperty({ nullable: true, type: String }) hy!: string | null;
  @ApiProperty({ nullable: true, type: String }) ru!: string | null;
  @ApiProperty({ nullable: true, type: String }) en!: string | null;
}

// ── Taxonomy ─────────────────────────────────────────────────────────────────
export class AttributeValueResponse {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() labelHy!: string;
  @ApiProperty() labelRu!: string;
  @ApiProperty() labelEn!: string;
  @ApiProperty() position!: number;
}

export class AttributeCategoryResponse {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() labelHy!: string;
  @ApiProperty() labelRu!: string;
  @ApiProperty() labelEn!: string;
  @ApiProperty() position!: number;
  @ApiProperty() isFilterable!: boolean;
  @ApiProperty({ type: [AttributeValueResponse] }) values!: AttributeValueResponse[];
}

// ── Discovery card (list) ────────────────────────────────────────────────────
export class AttributeSummaryResponse {
  @ApiProperty() slug!: string;
  @ApiProperty() labelHy!: string;
  @ApiProperty() labelRu!: string;
  @ApiProperty() labelEn!: string;
}

export class ConsumerBranchCardResponse {
  @ApiProperty() branchId!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty({ description: 'Brand name (Restaurant.name).' }) name!: string;
  @ApiProperty({ nullable: true, type: String }) logoUrl!: string | null;
  @ApiProperty({ nullable: true, type: String, description: 'First brand photo by position.' })
  heroPhotoUrl!: string | null;
  @ApiProperty({ nullable: true, type: String }) address!: string | null;
  @ApiProperty({ nullable: true, type: String }) city!: string | null;
  @ApiProperty() menuPublic!: boolean;
  @ApiProperty() reservationsPublic!: boolean;
  @ApiProperty({ type: [AttributeSummaryResponse], description: 'Short attribute summary.' })
  attributes!: AttributeSummaryResponse[];
}

// ── Detail ───────────────────────────────────────────────────────────────────
export class PublicHoursResponse {
  @ApiProperty({ description: '0=Mon … 6=Sun.' }) dayOfWeek!: number;
  @ApiProperty() isClosed!: boolean;
  @ApiProperty({ nullable: true, type: String, description: '"HH:mm".' }) opensAt!: string | null;
  @ApiProperty({ nullable: true, type: String, description: '"HH:mm".' }) closesAt!: string | null;
  @ApiProperty({ description: 'closesAt < opensAt ⇒ slot crosses midnight.' })
  crossesMidnight!: boolean;
}

export class PhotoResponse {
  @ApiProperty() id!: string;
  @ApiProperty() position!: number;
  @ApiProperty() url!: string;
  @ApiProperty({ type: I18nTextResponse }) alt!: I18nTextResponse;
  @ApiProperty({ nullable: true, type: Number }) width!: number | null;
  @ApiProperty({ nullable: true, type: Number }) height!: number | null;
}

export class FeatureGroupResponse {
  @ApiProperty() categorySlug!: string;
  @ApiProperty() labelHy!: string;
  @ApiProperty() labelRu!: string;
  @ApiProperty() labelEn!: string;
  @ApiProperty({ type: [AttributeSummaryResponse] }) values!: AttributeSummaryResponse[];
}

export class ConsumerBranchDetailResponse {
  @ApiProperty() branchId!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty({ description: 'Brand name (Restaurant.name).' }) name!: string;
  @ApiProperty({ nullable: true, type: String }) logoUrl!: string | null;
  @ApiProperty({ nullable: true, type: String }) address!: string | null;
  @ApiProperty({ nullable: true, type: String }) city!: string | null;
  @ApiProperty({ nullable: true, type: String }) publicPhone!: string | null;
  @ApiProperty({ nullable: true, type: String }) website!: string | null;
  @ApiProperty({ type: I18nTextResponse }) about!: I18nTextResponse;
  @ApiProperty({
    type: PublicHoursResponse,
    nullable: true,
    description: "Today's hours in branch-local time (null if no row for today).",
  })
  todayHours!: PublicHoursResponse | null;
  @ApiProperty({ type: [PublicHoursResponse] }) weeklyHours!: PublicHoursResponse[];
  @ApiProperty({ type: [PhotoResponse] }) gallery!: PhotoResponse[];
  @ApiProperty({ type: [FeatureGroupResponse], description: 'Attributes grouped by category.' })
  features!: FeatureGroupResponse[];
  @ApiProperty() menuPublic!: boolean;
  @ApiProperty() reservationsPublic!: boolean;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Public storefront menu path; present only when menuPublic.',
  })
  menuUrl!: string | null;
}

// ── Availability (privacy-safe: no customer PII) ─────────────────────────────
export class BusyWindowResponse {
  @ApiProperty({ description: 'ISO start of a reserved window.' }) start!: string;
  @ApiProperty({ description: 'ISO end of a reserved window.' }) end!: string;
}

export class TableBusyResponse {
  @ApiProperty() tableId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ description: 'Live table status.' }) status!: string;
  @ApiProperty({ type: [BusyWindowResponse], description: 'Reserved windows overlapping the query.' })
  busyWindows!: BusyWindowResponse[];
}

export class ConsumerAvailabilityResponse {
  @ApiProperty() branchId!: string;
  @ApiProperty() windowStart!: string;
  @ApiProperty() windowEnd!: string;
  @ApiProperty({ type: [TableBusyResponse] }) tables!: TableBusyResponse[];
}
