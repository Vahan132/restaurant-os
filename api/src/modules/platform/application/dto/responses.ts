import { ApiProperty } from '@nestjs/swagger';
import { Organization } from '../../domain/entities/organization';
import { Plan } from '../../domain/entities/plan';
import { PlatformUser } from '../../domain/entities/platform-user';
import { Subscription } from '../../domain/entities/subscription';
import {
  OrganizationDetail,
  OrganizationListItem,
} from '../../domain/repositories/organization.repository';

export class PlatformUserResponse {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ enum: ['SUPER_ADMIN', 'SUPPORT'] }) role!: string;
  @ApiProperty({ enum: ['ACTIVE', 'BLOCKED'] }) status!: string;
  @ApiProperty({ nullable: true, type: String }) lastLoginAt!: string | null;

  static from(u: PlatformUser): PlatformUserResponse {
    return {
      id: u.id,
      email: u.email.value,
      fullName: u.fullName,
      role: u.role,
      status: u.status,
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    };
  }
}

export class PlatformTokensResponse {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty() expiresIn!: number;
  @ApiProperty({ type: PlatformUserResponse }) user!: PlatformUserResponse;
}

export class PlanResponse {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() priceAmount!: number;
  @ApiProperty() currency!: string;
  @ApiProperty({ enum: ['MONTH', 'YEAR'] }) interval!: string;
  @ApiProperty({ type: Object }) features!: Record<string, unknown>;
  @ApiProperty() isActive!: boolean;

  static from(p: Plan): PlanResponse {
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      priceAmount: p.priceAmount,
      currency: p.currency,
      interval: p.interval,
      features: p.features as unknown as Record<string, unknown>,
      isActive: p.isActive,
    };
  }
}

export class OrganizationSummaryResponse {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() status!: string;

  static fromAggregate(o: Organization): OrganizationSummaryResponse {
    return { id: o.id, name: o.name, slug: o.slug, status: o.status };
  }

  static fromListItem(o: OrganizationListItem): OrganizationSummaryResponse {
    return { id: o.id, name: o.name, slug: o.slug, status: o.status };
  }
}

export class OrganizationDetailResponse {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ type: Object, nullable: true }) subscription!: Record<string, unknown> | null;
  @ApiProperty({ type: [Object] }) restaurants!: Record<string, unknown>[];
  @ApiProperty({ type: Object, nullable: true }) billingInfo!: Record<string, unknown> | null;
  @ApiProperty({ description: 'No payment processing yet — billing/payments integration pending.' })
  paymentsEnabled!: boolean;

  static from(
    d: OrganizationDetail,
    billingInfo: Record<string, unknown> | null = null,
  ): OrganizationDetailResponse {
    return {
      id: d.id,
      name: d.name,
      slug: d.slug,
      status: d.status,
      subscription: d.subscription as unknown as Record<string, unknown> | null,
      restaurants: d.restaurants as unknown as Record<string, unknown>[],
      billingInfo,
      paymentsEnabled: false,
    };
  }
}

export class SubscriptionResponse {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() planId!: string;
  @ApiProperty({ enum: ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'SUSPENDED'] })
  status!: string;
  @ApiProperty({ nullable: true, type: String }) trialEndsAt!: string | null;

  static from(s: Subscription): SubscriptionResponse {
    return {
      id: s.id,
      organizationId: s.organizationId,
      planId: s.planId,
      status: s.status,
      trialEndsAt: s.trialEndsAt ? s.trialEndsAt.toISOString() : null,
    };
  }
}

export class ProvisionResponse {
  @ApiProperty() organizationId!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty() ownerUserId!: string;
  @ApiProperty() ownerEmail!: string;
  @ApiProperty({ description: 'Returned ONCE. Generated if no password was supplied.' })
  ownerPassword!: string;
  @ApiProperty() passwordGenerated!: boolean;
}
