import { ApiProperty } from '@nestjs/swagger';
import { Branch } from '../../domain/entities/branch';
import { Restaurant } from '../../domain/entities/restaurant';
import { RestaurantSettings } from '../../domain/entities/restaurant-settings';

export class RestaurantResponse {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() currency!: string;
  @ApiProperty() defaultLanguage!: string;
  @ApiProperty() timezone!: string;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] }) status!: string;

  static from(r: Restaurant): RestaurantResponse {
    return {
      id: r.id,
      organizationId: r.organizationId,
      name: r.name,
      slug: r.slug,
      currency: r.currency,
      defaultLanguage: r.defaultLanguage,
      timezone: r.timezone,
      status: r.status,
    };
  }
}

export class RestaurantSettingsResponse {
  @ApiProperty() id!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty({ nullable: true, type: String }) logoUrl!: string | null;
  @ApiProperty({ nullable: true, type: String }) phone!: string | null;
  @ApiProperty({ nullable: true, type: String }) address!: string | null;
  @ApiProperty({ description: 'Tax rate, basis points.' }) taxRateBps!: number;
  @ApiProperty({ description: 'Service fee, basis points.' }) serviceFeeRateBps!: number;
  @ApiProperty({ nullable: true, type: String }) receiptFooter!: string | null;
  @ApiProperty({ type: Object, nullable: true }) openingHours!: unknown;
  @ApiProperty() allowDiscounts!: boolean;
  @ApiProperty() allowOrderCancellation!: boolean;
  @ApiProperty() requireApprovalForCancellation!: boolean;
  @ApiProperty() requireApprovalForDiscount!: boolean;
  @ApiProperty() enableReservations!: boolean;
  @ApiProperty() enableKds!: boolean;
  @ApiProperty() allowManualTableStatus!: boolean;
  @ApiProperty() enableQrMenu!: boolean;
  @ApiProperty() enableCustomerOrdering!: boolean;

  static from(s: RestaurantSettings): RestaurantSettingsResponse {
    const p = s.snapshot;
    return {
      id: s.id,
      restaurantId: p.restaurantId,
      logoUrl: p.logoUrl,
      phone: p.phone,
      address: p.address,
      taxRateBps: p.taxRateBps,
      serviceFeeRateBps: p.serviceFeeRateBps,
      receiptFooter: p.receiptFooter,
      openingHours: p.openingHours,
      allowDiscounts: p.allowDiscounts,
      allowOrderCancellation: p.allowOrderCancellation,
      requireApprovalForCancellation: p.requireApprovalForCancellation,
      requireApprovalForDiscount: p.requireApprovalForDiscount,
      enableReservations: p.enableReservations,
      enableKds: p.enableKds,
      allowManualTableStatus: p.allowManualTableStatus,
      enableQrMenu: p.enableQrMenu,
      enableCustomerOrdering: p.enableCustomerOrdering,
    };
  }
}

export class BranchResponse {
  @ApiProperty() id!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ description: 'BR-9: public-facing, per-restaurant unique slug.' })
  slug!: string;
  @ApiProperty({ description: 'Whether this is the restaurant default branch.' })
  isDefault!: boolean;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] }) status!: string;

  static from(b: Branch): BranchResponse {
    return {
      id: b.id,
      restaurantId: b.restaurantId,
      name: b.name,
      slug: b.slug,
      isDefault: b.isDefault,
      status: b.status,
    };
  }
}

/** Response for GET /branches/:id/my-access — effective perms at the active branch. */
export class MyBranchAccessResponse {
  @ApiProperty({ description: 'The active branch (from X-Branch-Id).' }) branchId!: string;
  @ApiProperty({ type: [String], description: 'Effective permissions at this branch.' })
  permissions!: string[];
}
