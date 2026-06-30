import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { IdentityModule } from '../identity/identity.module';
import { ConsumerModule } from '../consumer/consumer.module';
import { PASSWORD_HASHER } from '../identity/application/ports/password-hasher';
import { Argon2PasswordHasher } from '../identity/infrastructure/services/argon2-password-hasher';

import { PLATFORM_USER_REPOSITORY } from './domain/repositories/platform-user.repository';
import { ORGANIZATION_REPOSITORY } from './domain/repositories/organization.repository';
import { PLAN_REPOSITORY } from './domain/repositories/plan.repository';
import { SUBSCRIPTION_REPOSITORY } from './domain/repositories/subscription.repository';
import { ORGANIZATION_PROVISIONING_REPOSITORY } from './domain/repositories/provisioning.repository';
import { PLATFORM_TOKEN_SERVICE } from './application/ports/platform-token.service';
import { PLATFORM_REFRESH_TOKEN_REPOSITORY } from './application/ports/platform-refresh-token.repository';

import { PlatformLoginUseCase } from './application/commands/platform-login.usecase';
import { PlatformRefreshUseCase } from './application/commands/platform-refresh.usecase';
import { PlatformLogoutUseCase } from './application/commands/platform-logout.usecase';
import { PlatformGetMeUseCase } from './application/queries/platform-get-me.usecase';
import { ListPlansUseCase } from './application/queries/list-plans.usecase';
import { CreatePlanUseCase } from './application/commands/create-plan.usecase';
import { UpdatePlanUseCase } from './application/commands/update-plan.usecase';
import { DeactivatePlanUseCase } from './application/commands/deactivate-plan.usecase';
import { ProvisionOrganizationUseCase } from './application/commands/provision-organization.usecase';
import { ListOrganizationsUseCase } from './application/queries/list-organizations.usecase';
import { GetOrganizationUseCase } from './application/queries/get-organization.usecase';
import { SuspendOrganizationUseCase } from './application/commands/suspend-organization.usecase';
import { ActivateOrganizationUseCase } from './application/commands/activate-organization.usecase';
import { ChangePlanUseCase } from './application/commands/change-plan.usecase';
import { SetSubscriptionStatusUseCase } from './application/commands/set-subscription-status.usecase';
import { SUBSCRIPTION_HISTORY_REPOSITORY } from './application/ports/subscription-history.repository';
import { SubscriptionHistoryAppender } from './application/services/subscription-history-appender';
import { PrismaSubscriptionHistoryRepository } from './infrastructure/persistence/prisma-subscription-history.repository';
import { PlatformTokenIssuer } from './application/services/platform-token-issuer';

import { PrismaPlatformUserRepository } from './infrastructure/persistence/prisma-platform-user.repository';
import { PrismaPlatformRefreshTokenRepository } from './infrastructure/persistence/prisma-platform-refresh-token.repository';
import { PrismaPlanRepository } from './infrastructure/persistence/prisma-plan.repository';
import { PrismaOrganizationRepository } from './infrastructure/persistence/prisma-organization.repository';
import { PrismaSubscriptionRepository } from './infrastructure/persistence/prisma-subscription.repository';
import { PrismaOrganizationProvisioningRepository } from './infrastructure/persistence/prisma-organization-provisioning.repository';
import { PlatformJwtTokenService } from './infrastructure/services/platform-jwt-token.service';

import { PlatformAuthGuard } from './presentation/platform-auth.guard';
import { PlatformAuthController } from './presentation/http/platform-auth.controller';
import { PlansController } from './presentation/http/plans.controller';
import { OrganizationsController } from './presentation/http/organizations.controller';
import { SubscriptionsController } from './presentation/http/subscriptions.controller';
import { PlatformAdminController } from './presentation/http/platform-admin.controller';
import { PlatformConsumerListingController } from './presentation/http/platform-consumer-listing.controller';
import { PLATFORM_ADMIN_QUERY } from './application/ports/platform-admin-query.port';
import { PrismaPlatformAdminQueryService } from './infrastructure/persistence/prisma-platform-admin-query.service';
import { GetOrgRestaurantsUseCase } from './application/queries/get-org-restaurants.usecase';
import { GetSubscriptionHistoryUseCase } from './application/queries/get-subscription-history.usecase';
import { ListPlatformUsersUseCase } from './application/queries/list-platform-users.usecase';
import { GetPlatformDashboardUseCase } from './application/queries/get-platform-dashboard.usecase';

/**
 * Platform (cross-tenant super-admin) module. Imports IdentityModule to reuse
 * SystemRoleSeeder + UserFactory + ID_GENERATOR for provisioning. All routes
 * live under /platform and are protected solely by PlatformAuthGuard.
 */
@Module({
  imports: [JwtModule.register({}), IdentityModule, ConsumerModule],
  controllers: [
    PlatformAuthController,
    PlansController,
    OrganizationsController,
    SubscriptionsController,
    PlatformAdminController,
    PlatformConsumerListingController,
  ],
  providers: [
    PlatformAuthGuard,
    PlatformTokenIssuer,
    // auth
    PlatformLoginUseCase,
    PlatformRefreshUseCase,
    PlatformLogoutUseCase,
    PlatformGetMeUseCase,
    // plans
    ListPlansUseCase,
    CreatePlanUseCase,
    UpdatePlanUseCase,
    DeactivatePlanUseCase,
    // organizations / provisioning
    ProvisionOrganizationUseCase,
    ListOrganizationsUseCase,
    GetOrganizationUseCase,
    SuspendOrganizationUseCase,
    ActivateOrganizationUseCase,
    // subscriptions
    ChangePlanUseCase,
    SetSubscriptionStatusUseCase,
    SubscriptionHistoryAppender,
    // admin read panel
    GetOrgRestaurantsUseCase,
    GetSubscriptionHistoryUseCase,
    ListPlatformUsersUseCase,
    GetPlatformDashboardUseCase,

    // port -> implementation bindings
    { provide: PLATFORM_USER_REPOSITORY, useClass: PrismaPlatformUserRepository },
    { provide: PLATFORM_REFRESH_TOKEN_REPOSITORY, useClass: PrismaPlatformRefreshTokenRepository },
    { provide: PLAN_REPOSITORY, useClass: PrismaPlanRepository },
    { provide: ORGANIZATION_REPOSITORY, useClass: PrismaOrganizationRepository },
    { provide: SUBSCRIPTION_REPOSITORY, useClass: PrismaSubscriptionRepository },
    {
      provide: ORGANIZATION_PROVISIONING_REPOSITORY,
      useClass: PrismaOrganizationProvisioningRepository,
    },
    { provide: PLATFORM_TOKEN_SERVICE, useClass: PlatformJwtTokenService },
    // reuse identity's argon2 hasher implementation
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: SUBSCRIPTION_HISTORY_REPOSITORY, useClass: PrismaSubscriptionHistoryRepository },
    { provide: PLATFORM_ADMIN_QUERY, useClass: PrismaPlatformAdminQueryService },
  ],
  exports: [
    // Reused by the self-serve account module (signup + owner change-plan + history).
    ProvisionOrganizationUseCase,
    ChangePlanUseCase,
    ListPlansUseCase,
    PLAN_REPOSITORY,
    SUBSCRIPTION_REPOSITORY,
    SUBSCRIPTION_HISTORY_REPOSITORY,
  ],
})
export class PlatformModule {}
