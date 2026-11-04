import { Inject, Injectable } from '@nestjs/common';
import {
  BRANCH_ACCESS_RESOLVER,
  BranchAccessResolver,
} from '../../../../shared/auth/branch-access.resolver';
import { UseCase } from '../../../../shared/application/use-case';
import { EdgeConfigService } from '../../../../shared/edge/edge-config.service';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { DeviceSurface } from '../../domain/entities/device';
import { Role } from '../../domain/entities/role';
import { snapshotPermissionsForRole } from '../../domain/permissions.catalog';
import { User } from '../../domain/entities/user';
import { DEVICE_REPOSITORY, DeviceRepository } from '../../domain/repositories/device.repository';
import { ROLE_REPOSITORY, RoleRepository } from '../../domain/repositories/role.repository';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import {
  AccountBlocked,
  AdminDeviceRequired,
  InvalidCredentials,
  NoBranchAccessAtEdge,
} from '../application.errors';
import { AUTH_POLICY_READER, AuthPolicyReader } from '../ports/auth-policy.reader';
import { PASSWORD_HASHER, PasswordHasher } from '../ports/password-hasher';
import { AccountStateChecker } from '../services/account-state.checker';
import { AuthTokenIssuer } from '../services/auth-token-issuer';
import { hashDeviceSecret } from '../../infrastructure/services/device-secret.util';

/** The OWNER system role is the single break-glass allowance (3A). */
const OWNER_ROLE_CODE = 'OWNER';

export interface LoginInput {
  email: string;
  password: string;
  organizationId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  /**
   * 3A: optional ADMIN-surface device secret. Required for admin/manager login
   * unless the caller is the Owner (break-glass) or the restaurant has enabled
   * unanchored admin login.
   */
  deviceSecret?: string | null;
}

export interface LoginOutput {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
  permissions: string[];
}

/** Authenticate by email + password and issue an access/refresh token pair. */
@Injectable()
export class LoginUseCase implements UseCase<LoginInput, LoginOutput> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(BRANCH_ACCESS_RESOLVER) private readonly branchAccess: BranchAccessResolver,
    @Inject(DEVICE_REPOSITORY) private readonly devices: DeviceRepository,
    @Inject(AUTH_POLICY_READER) private readonly policy: AuthPolicyReader,
    private readonly issuer: AuthTokenIssuer,
    private readonly accountState: AccountStateChecker,
    private readonly events: DomainEventPublisher,
    private readonly edge: EdgeConfigService,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const email = input.email.trim().toLowerCase();

    const user = input.organizationId
      ? await this.users.findByEmail(input.organizationId, email)
      : await this.users.findByEmailGlobalUnique(email);

    if (!user || user.isDeleted()) {
      throw InvalidCredentials();
    }

    const ok = await this.hasher.verify(user.passwordHash.value, input.password);
    if (!ok) {
      throw InvalidCredentials();
    }

    if (!user.isActive()) {
      throw AccountBlocked();
    }

    // OFF-5: at the edge, a user may log in ONLY if they have access to the
    // branch this hub serves (a membership at it, or an all-branch role).
    if (this.edge.isEdge) {
      const id = this.edge.getIdentity();
      const access = await this.branchAccess.resolveForBranch({
        organizationId: user.organizationId,
        restaurantId: id.restaurantId,
        userId: user.id,
        branchId: id.branchId,
      });
      if (!access.branchExists || !access.hasAccess) {
        throw NoBranchAccessAtEdge();
      }
    }

    // Connect billing to access: org must be ACTIVE + subscription in good standing.
    await this.accountState.assertGoodStanding(user.organizationId);

    const role = await this.roles.findById(user.organizationId, user.roleId);

    // 3A: device-anchoring for admin/manager dashboard login (cloud path).
    if (!this.edge.isEdge) {
      await this.assertAdminAnchoring(user, role, input.deviceSecret ?? null, input.ip ?? null);
    }

    // System roles (OWNER/MANAGER/...) reconcile to the catalog so newly added
    // permissions reach them without a manual backfill; custom roles use stored.
    const permissions = snapshotPermissionsForRole(role);

    user.recordLogin(new Date(), input.ip ?? null, input.userAgent ?? null);
    await this.users.update(user);
    await this.events.publishFromAggregate(user);

    const tokens = await this.issuer.issueFor(user, permissions);
    return { ...tokens, user, permissions };
  }

  /**
   * 3A admin anchoring: Owner is always allowed (break-glass — resolves the
   * enrollment bootstrap). Else if the restaurant allows unanchored admin login,
   * any device is fine. Otherwise a valid, ACTIVE, ADMIN-surface device secret
   * for the user's restaurant is required.
   */
  private async assertAdminAnchoring(
    user: User,
    role: Role | null,
    deviceSecret: string | null,
    ip: string | null,
  ): Promise<void> {
    if (role?.code === OWNER_ROLE_CODE) {
      return; // break-glass
    }
    // Org-level principals (no restaurant) cannot be device-anchored.
    if (!user.restaurantId) {
      return;
    }
    if (await this.policy.allowsUnanchoredAdminLogin(user.restaurantId)) {
      return;
    }

    if (!deviceSecret) {
      throw AdminDeviceRequired();
    }
    const device = await this.devices.findActiveBySecretHash(hashDeviceSecret(deviceSecret));
    if (
      !device ||
      !device.isActive() ||
      device.restaurantId !== user.restaurantId ||
      device.surface !== DeviceSurface.ADMIN
    ) {
      throw AdminDeviceRequired();
    }
    device.recordSeen(ip);
    await this.devices.update(device);
  }
}
