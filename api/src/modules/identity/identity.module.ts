import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { ROLE_REPOSITORY } from './domain/repositories/role.repository';
import { USER_REPOSITORY } from './domain/repositories/user.repository';

import { ACCOUNT_STATE_READER } from './application/ports/account-state.reader';
import { ID_GENERATOR } from './application/ports/id-generator';
import { PASSWORD_HASHER } from './application/ports/password-hasher';
import { REFRESH_TOKEN_REPOSITORY } from './application/ports/refresh-token.repository';
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
import { AccountStateChecker } from './application/services/account-state.checker';
import { AuthTokenIssuer } from './application/services/auth-token-issuer';
import { SystemRoleSeeder } from './application/services/system-role-seeder';
import { UserFactory } from './application/services/user-factory';

import { PrismaAccountStateReader } from './infrastructure/persistence/prisma-account-state.reader';
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

import { AuthController } from './presentation/http/auth.controller';
import { RolesController } from './presentation/http/roles.controller';
import { UsersController } from './presentation/http/users.controller';

/**
 * Identity and Access Management module. Wires use cases and binds domain/
 * application PORTS to their infrastructure implementations via DI tokens.
 * Exports reusable services (UserFactory, SystemRoleSeeder, ID_GENERATOR) so the
 * platform module can provision organizations without duplicating logic.
 */
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController, UsersController, RolesController],
  providers: [
    AuthTokenIssuer,
    AccountStateChecker,
    UserFactory,
    SystemRoleSeeder,
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
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: PrismaRefreshTokenRepository },
    { provide: TENANT_STRUCTURE_READER, useClass: PrismaTenantStructureReader },
    { provide: ACCOUNT_STATE_READER, useClass: PrismaAccountStateReader },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    { provide: ID_GENERATOR, useClass: CuidIdGenerator },
    { provide: EMAIL_SERVICE, useClass: ConsoleEmailService },
    { provide: PASSWORD_RESET_TOKEN_REPOSITORY, useClass: PrismaPasswordResetTokenRepository },
  ],
  exports: [UserFactory, SystemRoleSeeder, ID_GENERATOR, LoginUseCase, USER_REPOSITORY],
})
export class IdentityModule {}
