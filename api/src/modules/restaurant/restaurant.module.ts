import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';

import { RESTAURANT_REPOSITORY } from './domain/repositories/restaurant.repository';
import { RESTAURANT_SETTINGS_REPOSITORY } from './domain/repositories/restaurant-settings.repository';
import { BRANCH_REPOSITORY } from './domain/repositories/branch.repository';
import { PLAN_LIMITS_READER } from './application/ports/plan-limits.reader';

import { GetRestaurantProfileUseCase } from './application/queries/get-restaurant-profile.usecase';
import { UpdateRestaurantProfileUseCase } from './application/commands/update-restaurant-profile.usecase';
import { GetRestaurantSettingsUseCase } from './application/queries/get-restaurant-settings.usecase';
import { UpdateRestaurantSettingsUseCase } from './application/commands/update-restaurant-settings.usecase';
import { ListBranchesUseCase } from './application/queries/list-branches.usecase';
import { GetBranchUseCase } from './application/queries/get-branch.usecase';
import { GetMyBranchAccessUseCase } from './application/queries/get-my-branch-access.usecase';
import { CreateBranchUseCase } from './application/commands/create-branch.usecase';
import { UpdateBranchUseCase } from './application/commands/update-branch.usecase';
import { DeactivateBranchUseCase } from './application/commands/deactivate-branch.usecase';
import { MakeDefaultBranchUseCase } from './application/commands/make-default-branch.usecase';

import { PrismaRestaurantRepository } from './infrastructure/persistence/prisma-restaurant.repository';
import { PrismaRestaurantSettingsRepository } from './infrastructure/persistence/prisma-restaurant-settings.repository';
import { PrismaBranchRepository } from './infrastructure/persistence/prisma-branch.repository';
import { PrismaPlanLimitsReader } from './infrastructure/persistence/prisma-plan-limits.reader';

import { RestaurantController } from './presentation/http/restaurant.controller';
import { BranchesController } from './presentation/http/branches.controller';

/**
 * Restaurant module (tenant-scoped). Protected by the global guards; writes
 * require SETTINGS_MANAGE. Imports IdentityModule to reuse ID_GENERATOR.
 */
@Module({
  imports: [IdentityModule],
  controllers: [RestaurantController, BranchesController],
  providers: [
    GetRestaurantProfileUseCase,
    UpdateRestaurantProfileUseCase,
    GetRestaurantSettingsUseCase,
    UpdateRestaurantSettingsUseCase,
    ListBranchesUseCase,
    GetBranchUseCase,
    GetMyBranchAccessUseCase,
    CreateBranchUseCase,
    UpdateBranchUseCase,
    DeactivateBranchUseCase,
    MakeDefaultBranchUseCase,

    { provide: RESTAURANT_REPOSITORY, useClass: PrismaRestaurantRepository },
    { provide: RESTAURANT_SETTINGS_REPOSITORY, useClass: PrismaRestaurantSettingsRepository },
    { provide: BRANCH_REPOSITORY, useClass: PrismaBranchRepository },
    { provide: PLAN_LIMITS_READER, useClass: PrismaPlanLimitsReader },
  ],
})
export class RestaurantModule {}
