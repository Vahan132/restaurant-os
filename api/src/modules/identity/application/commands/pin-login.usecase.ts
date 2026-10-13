import { Inject, Injectable } from '@nestjs/common';
import {
  BRANCH_ACCESS_RESOLVER,
  BranchAccessResolver,
} from '../../../../shared/auth/branch-access.resolver';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { DeviceSurface } from '../../domain/entities/device';
import { User } from '../../domain/entities/user';
import { snapshotPermissionsForRole } from '../../domain/permissions.catalog';
import { ROLE_REPOSITORY, RoleRepository } from '../../domain/repositories/role.repository';
import {
  DeviceSurfaceNotAllowed,
  InvalidDeviceSecret,
  InvalidPin,
  IpNotAllowed,
  PinLocked,
} from '../application.errors';
import { AuthTokenIssuer } from '../services/auth-token-issuer';
import { VerifyStaffPinService } from '../services/verify-staff-pin.service';

export interface PinLoginInput {
  deviceSecret: string;
  userId: string;
  pin: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface PinLoginOutput {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
  permissions: string[];
  /** The branch the device is bound to (POS sends it as X-Branch-Id afterwards). */
  branchId: string;
  /** True if the manager reset this PIN and the staff member should rotate it. */
  mustRotate: boolean;
}

/**
 * PIN login for POS/KDS. Delegates the device + IP + PIN + lockout checks to the
 * reusable VerifyStaffPinService, then issues the STANDARD JWT via the
 * per-restaurant signing key — identical downstream shape to email/password
 * login. No parallel signing path.
 */
@Injectable()
export class PinLoginUseCase implements UseCase<PinLoginInput, PinLoginOutput> {
  constructor(
    private readonly verifier: VerifyStaffPinService,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(BRANCH_ACCESS_RESOLVER) private readonly branchAccess: BranchAccessResolver,
    private readonly issuer: AuthTokenIssuer,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: PinLoginInput): Promise<PinLoginOutput> {
    const result = await this.verifier.verify({
      deviceSecret: input.deviceSecret,
      userId: input.userId,
      pin: input.pin,
      ip: input.ip ?? null,
      // PIN login is for POS + KDS only; ADMIN-surface devices are rejected.
      allowedSurfaces: [DeviceSurface.POS, DeviceSurface.KDS],
    });

    if (!result.ok) {
      throw this.toError(result.reason);
    }

    const { user, restaurantId, branchId, mustRotate } = result;

    // Branch isolation: the user must actually have access to the device's branch
    // (a membership there, or an all-branch role). Generic error — never reveal.
    const access = await this.branchAccess.resolveForBranch({
      organizationId: user.organizationId,
      restaurantId,
      userId: user.id,
      branchId,
    });
    if (!access.branchExists || !access.hasAccess) {
      throw InvalidPin();
    }

    const role = await this.roles.findById(user.organizationId, user.roleId);
    const permissions = snapshotPermissionsForRole(role);

    user.recordLogin(new Date(), input.ip ?? null, input.userAgent ?? null);
    await this.events.publishFromAggregate(user);

    const tokens = await this.issuer.issueFor(user, permissions);
    return { ...tokens, user, permissions, branchId, mustRotate };
  }

  private toError(reason: string): Error {
    switch (reason) {
      case 'INVALID_DEVICE':
        return InvalidDeviceSecret();
      case 'DEVICE_SURFACE':
        return DeviceSurfaceNotAllowed();
      case 'IP_NOT_ALLOWED':
        return IpNotAllowed();
      case 'PIN_LOCKED':
        return PinLocked();
      default:
        return InvalidPin();
    }
  }
}
