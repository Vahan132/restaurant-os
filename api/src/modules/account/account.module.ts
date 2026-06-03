import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { IdentityModule } from '../identity/identity.module';
import { PlatformModule } from '../platform/platform.module';
import { ACCOUNT_QUERY } from './application/ports/account-query.port';
import { BILLING_REPOSITORY } from './application/ports/billing.repository';
import { SignupUseCase } from './application/commands/signup.usecase';
import { OwnerChangePlanUseCase } from './application/commands/change-plan.usecase';
import { UpdateProfileUseCase } from './application/commands/update-profile.usecase';
import { UpsertBillingUseCase } from './application/commands/upsert-billing.usecase';
import { GetPlansUseCase } from './application/queries/get-plans.usecase';
import { CheckSubdomainUseCase } from './application/queries/check-subdomain.usecase';
import { GetAccountUseCase } from './application/queries/get-account.usecase';
import { GetSubscriptionUseCase } from './application/queries/get-subscription.usecase';
import { GetBillingUseCase } from './application/queries/get-billing.usecase';
import { ListHistoryUseCase } from './application/queries/list-history.usecase';
import { PrismaAccountQueryService } from './infrastructure/prisma-account-query.service';
import { PrismaBillingRepository } from './infrastructure/prisma-billing.repository';
import { AccountController } from './presentation/http/account.controller';
import { PublicAccountController } from './presentation/http/public-account.controller';

/**
 * Account module — self-serve account layer. PUBLIC signup/plans/subdomain
 * (no auth, throttled) + OWNER account/subscription/billing (ACCOUNT_MANAGE).
 * Reuses platform (ProvisionOrganization, ChangePlan, plan + history repos) and
 * identity (LoginUseCase for auto-login, USER_REPOSITORY for profile).
 */
@Module({
  imports: [IdentityModule, PlatformModule, ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }])],
  controllers: [PublicAccountController, AccountController],
  providers: [
    GetPlansUseCase,
    CheckSubdomainUseCase,
    SignupUseCase,
    GetAccountUseCase,
    UpdateProfileUseCase,
    GetSubscriptionUseCase,
    OwnerChangePlanUseCase,
    GetBillingUseCase,
    UpsertBillingUseCase,
    ListHistoryUseCase,
    { provide: ACCOUNT_QUERY, useClass: PrismaAccountQueryService },
    { provide: BILLING_REPOSITORY, useClass: PrismaBillingRepository },
  ],
})
export class AccountModule {}
