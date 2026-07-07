import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { BRANCH_ACCESS_RESOLVER } from '../../shared/auth/branch-access.resolver';

import { ROLE_REPOSITORY } from './domain/repositories/role.repository';
import { USER_REPOSITORY } from './domain/repositories/user.repository';
import { BRANCH_MEMBERSHIP_REPOSITORY } from './domain/repositories/branch-membership.repository';
import { DEVICE_REPOSITORY } from './domain/repositories/device.repository';
import { STAFF_PIN_REPOSITORY } from './domain/repositories/staff-pin.repository';
import { STEP_UP_THROTTLE_REPOSITORY } from './domain/repositories/step-up-throttle.repository';

import { ACCOUNT_STATE_READER } from './application/ports/account-state.reader';
import { AUTH_POLICY_READER } from './application/ports/auth-policy.reader';
import { BRANCH_DIRECTORY_READER } from './application/ports/branch-directory.reader';
import { ID_GENERATOR } from './application/ports/id-generator';
import { PASSWORD_HASHER } from './application/ports/password-hasher';
import { REFRESH_TOKEN_REPOSITORY } from './application/ports/refresh-token.repository';
import { RESTAURANT_KEY_PROVIDER } from './application/ports/restaurant-key.provider';
import { STAFF_DIRECTORY_READER } from './application/ports/staff-directory.reader';
import { TENANT_STRUCTURE_READER } from './application/ports/tenant-structure.reader';
import { TOKEN_SERVICE } from './application/ports/token.service';

import { BlockUserUseCase } from './application/commands/block-user.usecase';
import { ChangePasswordUseCase } from './application/commands/change-password.usecase';
import { CreateRoleUseCase } from './application/commands/create-role.usecase';
import { CreateUserUseCase } from './application/commands/create-user.usecase';
import { DeleteRoleUseCase } from './application/commands/delete-role.usecase';
import { LoginUseCase } from './application/commands/login.usecase';
import { ForgotPasswordUseCase } from './application/commands/forgot-password.usecase';
import { ResetPasswordUseCase } from './application/commands/reset-password.usecase';
import { LogoutUseCase } from './application/commands/logout.usecase';
import { RefreshTokenUseCase } from './application/commands/refresh-token.usecase';
import { UnblockUserUseCase } from './application/commands/unblock-user.usecase';
import { UpdateRoleUseCase } from './application/commands/update-role.usecase';
import { UpdateUserUseCase } from './application/commands/update-user.usecase';
import { GetMeUseCase } from './application/queries/get-me.usecase';
import { GetPermissionsUseCase } from './application/queries/get-permissions.usecase';
import { GetUserUseCase } from './application/queries/get-user.usecase';
import { ListRolesUseCase } from './application/queries/list-roles.usecase';
import { ListUsersUseCase } from './application/queries/list-users.usecase';
import { UpsertBranchMembershipUseCase } from './application/commands/upsert-branch-membership.usecase';
import { RemoveBranchMembershipUseCase } from './application/commands/remove-branch-membership.usecase';
import { ListBranchMembershipsUseCase } from './application/queries/list-branch-memberships.usecase';
import { EnrollDeviceUseCase } from './application/commands/enroll-device.usecase';
import { RevokeDeviceUseCase } from './application/commands/revoke-device.usecase';
import { ListDevicesUseCase } from './application/queries/list-devices.usecase';
import { CreateStaffPinUseCase } from './application/commands/create-staff-pin.usecase';
import { ResetStaffPinUseCase } from './application/commands/reset-staff-pin.usecase';
import { RevokeStaffPinUseCase } from './application/commands/revoke-staff-pin.usecase';
import { PinLoginUseCase } from './application/commands/pin-login.usecase';
import { ListBranchStaffUseCase } from './application/queries/list-branch-staff.usecase';
import { AccountStateChecker } from './application/services/account-state.checker';
import { AuthTokenIssuer } from './application/services/auth-token-issuer';
import { EffectiveBranchAccessService } from './application/services/effective-branch-access.service';
import { SystemRoleSeeder } from './application/services/system-role-seeder';
import { UserFactory } from './application/services/user-factory';
import { VerifyStaffPinService } from './application/services/verify-staff-pin.service';
import { StepUpAuthorizationService } from './application/services/step-up-authorization.service';

import { PrismaAccountStateReader } from './infrastructure/persistence/prisma-account-state.reader';
import { PrismaAuthPolicyReader } from './infrastructure/persistence/prisma-auth-policy.reader';
import { PrismaBranchDirectoryReader } from './infrastructure/persistence/prisma-branch-directory.reader';
import { PrismaBranchMembershipRepository } from './infrastructure/persistence/prisma-branch-membership.repository';
import { PrismaDeviceRepository } from './infrastructure/persistence/prisma-device.repository';
import { PrismaStaffPinRepository } from './infrastructure/persistence/prisma-staff-pin.repository';
import { PrismaStepUpThrottleRepository } from './infrastructure/persistence/prisma-step-up-throttle.repository';
import { PrismaStaffDirectoryReader } from './infrastructure/persistence/prisma-staff-directory.reader';
import { PrismaRefreshTokenRepository } from './infrastructure/persistence/prisma-refresh-token.repository';
import { PrismaRoleRepository } from './infrastructure/persistence/prisma-role.repository';
import { PrismaTenantStructureReader } from './infrastructure/persistence/prisma-tenant-structure.reader';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';
import { PrismaPasswordResetTokenRepository } from './infrastructure/persistence/prisma-password-reset-token.repository';
import { ConsoleEmailService } from './infrastructure/services/console-email.service';
import { EMAIL_SERVICE } from './application/ports/email.service';
import { PASSWORD_RESET_TOKEN_REPOSITORY } from './application/ports/password-reset-token.repository';
import { Argon2PasswordHasher } from './infrastructure/services/argon2-password-hasher';
import { CuidIdGenerator } from './infrastructure/services/cuid-id-generator';
import { JwtTokenService } from './infrastructure/services/jwt-token.service';
import { RolePermissionsCache } from './infrastructure/services/role-permissions.cache';
import { PrismaRestaurantKeyProvider } from './infrastructure/services/prisma-restaurant-key.provider';

import { AuthController } from './presentation/http/auth.controller';
import { BranchMembershipsController } from './presentation/http/branch-memberships.controller';
import { RolesController } from './presentation/http/roles.controller';
import { UsersController } from './presentation/http/users.controller';
import { DevicesController } from './presentation/http/devices.controller';
import { StaffPinsController } from './presentation/http/staff-pins.controller';
import { PinAuthController } from './presentation/http/pin-auth.controller';
import { DeviceSecretGuard } from './presentation/http/device-secret.guard';

/**
 * Identity and Access Management module. Wires use cases and binds domain/
 * application PORTS to their infrastructure implementations via DI tokens.
 * Exports reusable services (UserFactory, SystemRoleSeeder, ID_GENERATOR) so the
 * platform module can provision organizations without duplicating logic.
 */
@Module({
  imports: [JwtModule.register({})],
  controllers: [
    AuthController,
    UsersController,
    BranchMembershipsController,
    RolesController,
    DevicesController,
    StaffPinsController,
    PinAuthController,
  ],
  providers: [
    AuthTokenIssuer,
    AccountStateChecker,
    UserFactory,
    SystemRoleSeeder,
    EffectiveBranchAccessService,
    RolePermissionsCache,
    UpsertBranchMembershipUseCase,
    RemoveBranchMembershipUseCase,
    ListBranchMembershipsUseCase,
    // 3A: device-anchored staff auth.
    VerifyStaffPinService,
    // 4A: manager step-up authorization (reuses VerifyStaffPinService).
    StepUpAuthorizationService,
    EnrollDeviceUseCase,
    ListDevicesUseCase,
    RevokeDeviceUseCase,
    CreateStaffPinUseCase,
    ResetStaffPinUseCase,
    RevokeStaffPinUseCase,
    PinLoginUseCase,
    ListBranchStaffUseCase,
    DeviceSecretGuard,
    LoginUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    GetMeUseCase,
    CreateUserUseCase,
    UpdateUserUseCase,
    BlockUserUseCase,
    UnblockUserUseCase,
    ChangePasswordUseCase,
    ListUsersUseCase,
    GetUserUseCase,
    ListRolesUseCase,
    CreateRoleUseCase,
    UpdateRoleUseCase,
    DeleteRoleUseCase,
    GetPermissionsUseCase,
    ForgotPasswordUseCase,
    ResetPasswordUseCase,

    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: ROLE_REPOSITORY, useClass: PrismaRoleRepository },
    { provide: BRANCH_MEMBERSHIP_REPOSITORY, useClass: PrismaBranchMembershipRepository },
    { provide: DEVICE_REPOSITORY, useClass: PrismaDeviceRepository },
    { provide: STAFF_PIN_REPOSITORY, useClass: PrismaStaffPinRepository },
    { provide: STEP_UP_THROTTLE_REPOSITORY, useClass: PrismaStepUpThrottleRepository },
    { provide: AUTH_POLICY_READER, useClass: PrismaAuthPolicyReader },
    { provide: STAFF_DIRECTORY_READER, useClass: PrismaStaffDirectoryReader },
    { provide: BRANCH_DIRECTORY_READER, useClass: PrismaBranchDirectoryReader },
    { provide: BRANCH_ACCESS_RESOLVER, useExisting: EffectiveBranchAccessService },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: PrismaRefreshTokenRepository },
    { provide: TENANT_STRUCTURE_READER, useClass: PrismaTenantStructureReader },
    { provide: ACCOUNT_STATE_READER, useClass: PrismaAccountStateReader },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    { provide: RESTAURANT_KEY_PROVIDER, useClass: PrismaRestaurantKeyProvider },
    { provide: ID_GENERATOR, useClass: CuidIdGenerator },
    { provide: EMAIL_SERVICE, useClass: ConsoleEmailService },
    { provide: PASSWORD_RESET_TOKEN_REPOSITORY, useClass: PrismaPasswordResetTokenRepository },
  ],
  exports: [
    UserFactory,
    SystemRoleSeeder,
    ID_GENERATOR,
    LoginUseCase,
    USER_REPOSITORY,
    // Exported so the restaurant module's CreateBranchUseCase can auto-grant the
    // creator a membership at a newly created branch (FIX-BR-1).
    BRANCH_MEMBERSHIP_REPOSITORY,
    // Exported so SecurityModule's BranchAccessGuard (and the restaurant module's
    // my-access use case) can resolve effective branch access.
    BRANCH_ACCESS_RESOLVER,
    // Exported so SecurityModule's PermissionsGuard resolves the caller's
    // restaurant-wide permissions fresh (never from the frozen JWT snapshot).
    RolePermissionsCache,
    // OFF-5: exported so the JwtAuthGuard (SecurityModule) and RealtimeGateway
    // (RealtimeModule) can verify tokens with the per-restaurant key.
    TOKEN_SERVICE,
    RESTAURANT_KEY_PROVIDER,
    // 3A: exported so 3B (edge) and the later discount step-up can reuse the
    // device-anchored PIN verification UNCHANGED.
    VerifyStaffPinService,
    // 4A: exported so the orders module can require manager step-up to authorize
    // a discount applied by a user who lacks DISCOUNT_APPLY.
    StepUpAuthorizationService,
    DEVICE_REPOSITORY,
    STAFF_PIN_REPOSITORY,
  ],
})
export class IdentityModule {}
