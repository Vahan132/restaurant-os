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
