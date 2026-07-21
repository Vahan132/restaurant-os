import { ApiProperty } from '@nestjs/swagger';
import { UserResponse } from '../../../identity/application/dto/responses';

export class PublicPlanResponse {
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() priceAmount!: number;
  @ApiProperty() currency!: string;
  @ApiProperty() interval!: string;
  @ApiProperty({ type: Object, nullable: true }) features!: unknown;
}

export class SubdomainAvailableResponse {
  @ApiProperty() available!: boolean;
  @ApiProperty({ nullable: true, type: String }) reason!: string | null;
}

export class EmailAvailableResponse {
  @ApiProperty() available!: boolean;
  @ApiProperty({ nullable: true, type: String }) reason!: string | null;
}

export class SignupResponse {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ type: UserResponse }) user!: UserResponse;
}

export class SubscriptionHistoryResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ nullable: true, type: String }) fromStatus!: string | null;
  @ApiProperty({ nullable: true, type: String }) toStatus!: string | null;
  @ApiProperty({ nullable: true, type: String }) fromPlanId!: string | null;
  @ApiProperty({ nullable: true, type: String }) toPlanId!: string | null;
  @ApiProperty() changedByType!: string;
  @ApiProperty({ nullable: true, type: String }) reason!: string | null;
  @ApiProperty() createdAt!: string;
}

export class BillingResponse {
  @ApiProperty({ nullable: true, type: Object }) billing!: unknown;
  @ApiProperty({ type: [SubscriptionHistoryResponse] })
  subscriptionHistory!: SubscriptionHistoryResponse[];
  @ApiProperty({ type: [Object], description: 'Placeholder — invoicing is future.' })
  invoices!: unknown[];
}

// ---------------------------------------------------------------------------
// Account overview + subscription response DTOs (WEBSITE-DTO-1).
// These type the shapes GET /account and GET /account/subscription already
// return at runtime (see account-query.port.ts AccountOverview /
// AccountSubscriptionView). No logic change — only formal typing so the spec
// emits the schemas the website's generated client re-exports.
// ---------------------------------------------------------------------------

/** Organization summary embedded in the account overview. */
export class AccountOrganizationSummary {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
}

/** Primary restaurant summary embedded in the account overview (nullable). */
export class AccountRestaurantSummary {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
}

/** Account owner summary embedded in the account overview. */
export class AccountOwnerSummary {
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
}

/** Condensed subscription block embedded in the account overview (nullable). */
export class AccountSubscriptionSummary {
  @ApiProperty() status!: string;
  @ApiProperty({ nullable: true, type: String }) planCode!: string | null;
  @ApiProperty({ nullable: true, type: String }) planName!: string | null;
  @ApiProperty({ nullable: true, type: String }) currentPeriodEnd!: string | null;
  @ApiProperty({ nullable: true, type: String }) trialEndsAt!: string | null;
}

/** GET /account — organization, restaurant, subscription, owner. */
export class AccountOverviewResponse {
  @ApiProperty({ type: AccountOrganizationSummary })
  organization!: AccountOrganizationSummary;

  @ApiProperty({ type: AccountRestaurantSummary, nullable: true })
  restaurant!: AccountRestaurantSummary | null;

  @ApiProperty({ type: AccountSubscriptionSummary, nullable: true })
  subscription!: AccountSubscriptionSummary | null;

  @ApiProperty({ type: AccountOwnerSummary })
  owner!: AccountOwnerSummary;
}

/** GET /account/subscription — current subscription + plan + recent history. */
export class AccountSubscriptionDetailResponse {
  @ApiProperty() status!: string;
  @ApiProperty({ nullable: true, type: String }) planCode!: string | null;
  @ApiProperty({ nullable: true, type: String }) planName!: string | null;
  @ApiProperty({ nullable: true, type: Number }) priceAmount!: number | null;
  @ApiProperty({ nullable: true, type: String }) currency!: string | null;
  @ApiProperty({ nullable: true, type: String }) interval!: string | null;
  @ApiProperty({ nullable: true, type: String }) currentPeriodEnd!: string | null;
  @ApiProperty({ nullable: true, type: String }) trialEndsAt!: string | null;
  @ApiProperty({ type: [SubscriptionHistoryResponse] })
  recentHistory!: SubscriptionHistoryResponse[];
}
