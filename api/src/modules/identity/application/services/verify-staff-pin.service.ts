import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../../shared/infrastructure/config/env.schema';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { Device, DeviceSurface } from '../../domain/entities/device';
import { StaffPin } from '../../domain/entities/staff-pin';
import { User } from '../../domain/entities/user';
import { DEVICE_REPOSITORY, DeviceRepository } from '../../domain/repositories/device.repository';
import {
  STAFF_PIN_REPOSITORY,
  StaffPinRepository,
} from '../../domain/repositories/staff-pin.repository';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import { AUTH_POLICY_READER, AuthPolicyReader } from '../ports/auth-policy.reader';
import { PASSWORD_HASHER, PasswordHasher } from '../ports/password-hasher';
import { hashDeviceSecret } from '../../infrastructure/services/device-secret.util';
import { ipMatchesAllowlist } from '../../infrastructure/services/ip-match.util';

export type VerifyStaffPinFailureReason =
  | 'INVALID_DEVICE'
  | 'DEVICE_SURFACE'
  | 'IP_NOT_ALLOWED'
  | 'PIN_LOCKED'
  | 'INVALID_PIN';

export interface VerifyStaffPinInput {
  /** Plaintext device secret presented by the POS/KDS/step-up surface. */
  deviceSecret: string;
  /** The user selected from the branch staff picker. */
  userId: string;
  /** 6-digit PIN. */
  pin: string;
  /** Real client IP (from trust-proxy-resolved req.ip). */
  ip?: string | null;
  /** Surfaces the device is allowed to serve (PIN login => [POS, KDS]). */
  allowedSurfaces: DeviceSurface[];
}

export type VerifyStaffPinResult =
  | {
      ok: true;
      user: User;
      device: Device;
      staffPin: StaffPin;
      restaurantId: string;
      branchId: string;
      mustRotate: boolean;
    }
  | { ok: false; reason: VerifyStaffPinFailureReason };

/**
 * Reusable core of device-anchored staff auth: "verify THIS user's PIN on THIS
 * enrolled device, applying branch IP policy + per-user rate-limit + lockout".
 *
 * There is NO PIN path that doesn't go through a valid device secret — that
 * coupling is enforced here, in one place. Returns a clear success/failure result
 * (it never throws on auth failure) so callers map it to their own response:
 *   - PIN login (POS/KDS) issues a JWT on success;
 *   - 3B (edge) and the later discount step-up reuse this UNCHANGED.
 */
@Injectable()
export class VerifyStaffPinService {
  constructor(
    @Inject(DEVICE_REPOSITORY) private readonly devices: DeviceRepository,
    @Inject(STAFF_PIN_REPOSITORY) private readonly pins: StaffPinRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(AUTH_POLICY_READER) private readonly policy: AuthPolicyReader,
    private readonly events: DomainEventPublisher,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async verify(input: VerifyStaffPinInput): Promise<VerifyStaffPinResult> {
    const ip = input.ip ?? null;

    // 1. The device is the real first factor: resolve it from the secret.
    const device = await this.devices.findActiveBySecretHash(hashDeviceSecret(input.deviceSecret));
    if (!device || !device.isActive()) {
      return { ok: false, reason: 'INVALID_DEVICE' };
    }
    if (!input.allowedSurfaces.includes(device.surface)) {
      return { ok: false, reason: 'DEVICE_SURFACE' };
    }

    // 2. Branch IP policy (STRICT blocks out-of-allowlist; SOFT trusts + records).
    const ipPolicy = await this.policy.getBranchIpPolicy(device.restaurantId, device.branchId);
    if (ipPolicy && ipPolicy.mode === 'STRICT' && !ipMatchesAllowlist(ip, ipPolicy.allowlist)) {
      return { ok: false, reason: 'IP_NOT_ALLOWED' };
    }

    // 3. Resolve the chosen user; must belong to the device's restaurant + active.
    const user = await this.users.findByIdGlobal(input.userId);
    if (
      !user ||
      user.isDeleted() ||
      !user.isActive() ||
      user.restaurantId !== device.restaurantId
    ) {
      return { ok: false, reason: 'INVALID_PIN' };
    }

    // 4. The user's PIN (per-user lockout lives on this row).
    const staffPin = await this.pins.findByUserId(input.userId);
    if (!staffPin || !staffPin.isActive()) {
      return { ok: false, reason: 'INVALID_PIN' };
    }
    if (staffPin.isLocked()) {
      return { ok: false, reason: 'PIN_LOCKED' };
    }

    // 5. Verify the PIN (argon2), then drive the lockout state machine.
    const ok = await this.hasher.verify(staffPin.pinHash, input.pin);
    if (!ok) {
      const justLocked = staffPin.registerFailure(this.maxAttempts(), this.lockoutMs(), {
        branchId: device.branchId,
        deviceId: device.id,
        ip,
      });
      await this.pins.update(staffPin);
      await this.events.publishFromAggregate(staffPin);
      return { ok: false, reason: justLocked ? 'PIN_LOCKED' : 'INVALID_PIN' };
    }

    staffPin.registerSuccess();
    device.recordSeen(ip);
    await this.pins.update(staffPin);
    await this.devices.update(device);

    return {
      ok: true,
      user,
      device,
      staffPin,
      restaurantId: device.restaurantId,
      branchId: device.branchId,
      mustRotate: staffPin.mustRotate,
    };
  }

  private maxAttempts(): number {
    return this.config.get('PIN_MAX_ATTEMPTS', { infer: true });
  }

  private lockoutMs(): number {
    return this.config.get('PIN_LOCKOUT_MINUTES', { infer: true }) * 60_000;
  }
}
