import { Body, Controller, Get, HttpCode, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Paginated } from '../../../../shared/application/pagination';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { UserResponse } from '../../../identity/application/dto/responses';
import {
  ChangePlanDto,
  HistoryQuery,
  UpdateBillingDto,
  UpdateProfileDto,
} from '../../application/dto/account.dto';
import {
  AccountOverview,
  AccountSubscriptionView,
} from '../../application/ports/account-query.port';
import { BillingResponse, SubscriptionHistoryResponse } from '../../application/dto/responses';
import { OwnerChangePlanUseCase } from '../../application/commands/change-plan.usecase';
import { UpdateProfileUseCase } from '../../application/commands/update-profile.usecase';
import { UpsertBillingUseCase } from '../../application/commands/upsert-billing.usecase';
import { GetAccountUseCase } from '../../application/queries/get-account.usecase';
import { GetBillingUseCase } from '../../application/queries/get-billing.usecase';
import { GetSubscriptionUseCase } from '../../application/queries/get-subscription.usecase';
import { ListHistoryUseCase } from '../../application/queries/list-history.usecase';

const P = PERMISSIONS;

@ApiTags('account')
@ApiBearerAuth('access-token')
@ApiForbiddenResponse({ description: 'Missing ACCOUNT_MANAGE permission.' })
@RequirePermissions(P.ACCOUNT_MANAGE)
@Controller('account')
export class AccountController {
  constructor(
    private readonly getAccount: GetAccountUseCase,
    private readonly updateProfile: UpdateProfileUseCase,
    private readonly getSubscription: GetSubscriptionUseCase,
    private readonly changePlan: OwnerChangePlanUseCase,
    private readonly getBilling: GetBillingUseCase,
    private readonly upsertBilling: UpsertBillingUseCase,
    private readonly listHistory: ListHistoryUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Account overview (organization, restaurant, subscription, owner).' })
  account(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
  ): Promise<AccountOverview> {
    return this.getAccount.execute({ organizationId: tenant.organizationId, userId: user.sub });
  }

  @Patch('profile')
  @ApiOperation({ summary: "Update the owner's display name." })
  @ApiOkResponse({ type: UserResponse })
  async profile(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponse> {
    const updated = await this.updateProfile.execute({
      organizationId: tenant.organizationId,
      userId: user.sub,
      fullName: dto.fullName,
    });
    return UserResponse.from(updated);
  }

  @Get('subscription')
  @ApiOperation({ summary: 'Current subscription + plan + recent history.' })
  subscription(@CurrentTenant() tenant: TenantContext): Promise<AccountSubscriptionView> {
    return this.getSubscription.execute({ organizationId: tenant.organizationId });
  }

  @Post('subscription/change-plan')
  @HttpCode(200)
  @ApiOperation({ summary: 'Change the subscription plan (history appended as USER).' })
  change(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Body() dto: ChangePlanDto,
  ): Promise<AccountSubscriptionView> {
    return this.changePlan.execute({
      organizationId: tenant.organizationId,
      userId: user.sub,
      planCode: dto.planCode,
    });
  }

  @Get('subscription/history')
  @ApiOperation({ summary: 'Subscription change history (paginated).' })
  @ApiOkResponse({ type: [SubscriptionHistoryResponse] })
  async history(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: HistoryQuery,
  ): Promise<Paginated<SubscriptionHistoryResponse>> {
    const page = await this.listHistory.execute({
      organizationId: tenant.organizationId,
      page: query.page,
      limit: query.limit,
    });
    return {
      data: page.data.map((r) => ({
        id: r.id,
        fromStatus: r.fromStatus,
        toStatus: r.toStatus,
        fromPlanId: r.fromPlanId,
        toPlanId: r.toPlanId,
        changedByType: r.changedByType,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
      })),
      pagination: page.pagination,
    };
  }

  @Get('billing')
  @ApiOperation({ summary: 'Billing info + subscription history + (empty) invoices.' })
  @ApiOkResponse({ type: BillingResponse })
  billing(@CurrentTenant() tenant: TenantContext): Promise<BillingResponse> {
    return this.getBilling.execute({ organizationId: tenant.organizationId });
  }

  @Patch('billing')
  @ApiOperation({ summary: 'Upsert billing info (no payment method — future).' })
  billingUpsert(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdateBillingDto,
  ): Promise<unknown> {
    return this.upsertBilling.execute({
      organizationId: tenant.organizationId,
      billingName: dto.billingName ?? null,
      billingEmail: dto.billingEmail ?? null,
      billingAddress: dto.billingAddress ?? null,
      taxId: dto.taxId ?? null,
    });
  }
}
