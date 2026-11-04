import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../../shared/infrastructure/config/env.schema';
import {
  BRANCH_ACCESS_RESOLVER,
  BranchAccessResolver,
} from '../../../../shared/auth/branch-access.resolver';
import { DeviceSurface } from '../../domain/entities/device';
import { DEVICE_REPOSITORY, DeviceRepository } from '../../domain/repositories/device.repository';
import {
  STAFF_PIN_REPOSITORY,
  StaffPinRepository,
} from '../../domain/repositories/staff-pin.repository';
import {
  STEP_UP_THROTTLE_REPOSITORY,
  StepUpThrottleRepository,
} from '../../domain/repositories/step-up-throttle.repository';
import { RESTAURANT_KEY_PROVIDER, RestaurantKeyProvider } from '../ports/restaurant-key.provider';
import { hashDeviceSecret, pinFingerprint } from '../../infrastructure/services/device-secret.util';
import { VerifyStaffPinService } from './verify-staff-pin.service';

/**
 * Why each step-up attempt failed. Kept INTERNAL (logs/audit only) — the HTTP
 * surface returns a single generic "authorization failed" so a brute-forcer
 * cannot tell wrong-PIN from no-capability from bad-device.
 */
export type StepUpFailureReason =
  | 'INVALID_DEVICE' // no ACTIVE device for the secret, or wrong branch/restaurant
  | 'DEVICE_LOCKED' // device step-up is in cooldown
  | 'KEY_UNAVAILABLE' // restaurant signing key not resolvable (server-side)
  | 'NO_MATCH' // no active PIN matches the entered code
  | 'NO_CAPABILITY' // the matched user does not hold the permission at this branch
  | 'INVALID_PIN'; // device/IP/surface/PIN rejected by the 3A primitive

export interface StepUpAuthorizeInput {
  organizationId: string;
  restaurantId: string;
  /** The branch the discount (and POS device) belongs to. */
  branchId: string;
  /** Plaintext device secret of the enrolled POS device. */
  deviceSecret: string;
  /** The authorizing manager's 6-digit PIN. */
  pin: string;
  /** Real client IP (trust-proxy resolved). */
  ip: string | null;
  /** The permission an authorizer must hold AT THIS BRANCH (DISCOUNT_APPLY). */
  requiredPermission: string;
}

export type StepUpAuthorizeResult =
  | { ok: true; authorizerUserId: string; deviceId: string }
  | { ok: false; reason: StepUpFailureReason; deviceId: string | null };

/**
 * Manager step-up authorization (4A). Verifies that a CAPABLE manager approved a
 * single privileged action (a POS discount) by entering their PIN on an enrolled
 * device — WITHOUT logging anyone in and WITHOUT a name picker.
 *
 * Reuses the 3A primitives unchanged:
 *   - the device secret resolves an ACTIVE device (the real first factor);
 *   - the restaurant-scoped PIN FINGERPRINT identifies the single candidate
 *     authorizer (so we never iterate managers and trip their per-user lockouts);
 *   - VerifyStaffPinService.verify() does the actual argon2 + IP-policy + lockout.
 *
 * Adds a DEVICE-scoped throttle on top so the small set of POS devices is not a
 * brute-force surface. Returns a generic ok/!ok; the specific reason is for the
 * caller's audit/log only.
 */
@Injectable()
export class StepUpAuthorizationService {
  constructor(
    @Inject(DEVICE_REPOSITORY) private readonly devices: DeviceRepository,
    @Inject(STAFF_PIN_REPOSITORY) private readonly pins: StaffPinRepository,
    @Inject(STEP_UP_THROTTLE_REPOSITORY) private readonly throttle: StepUpThrottleRepository,
    @Inject(RESTAURANT_KEY_PROVIDER) private readonly keys: RestaurantKeyProvider,
    @Inject(BRANCH_ACCESS_RESOLVER) private readonly access: BranchAccessResolver,
    private readonly verifyPin: VerifyStaffPinService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async authorize(input: StepUpAuthorizeInput): Promise<StepUpAuthorizeResult> {
    const ip = input.ip ?? null;

    // 1. Device is the first factor. Resolve from the secret; it must be ACTIVE
    //    and belong to the discount's restaurant + branch (POS surface).
    const device = await this.devices.findActiveBySecretHash(hashDeviceSecret(input.deviceSecret));
    if (
      !device ||
      !device.isActive() ||
      device.restaurantId !== input.restaurantId ||
      device.branchId !== input.branchId ||
      device.surface !== DeviceSurface.POS
    ) {
      // No known device to throttle — fail generic without a row.
      return { ok: false, reason: 'INVALID_DEVICE', deviceId: null };
    }

    // 2. Device-scoped lockout: if cooling down, reject before touching PINs.
    const now = new Date();
    const state = await this.throttle.findByDeviceId(device.id);
    if (state?.lockedUntil && state.lockedUntil.getTime() > now.getTime()) {
      return { ok: false, reason: 'DEVICE_LOCKED', deviceId: device.id };
    }

    // 3. Identify the SINGLE candidate authorizer by PIN fingerprint (no picker,
    //    no manager-iteration). Needs the restaurant signing key.
    const signingKey = await this.keys.getSigningKey(input.restaurantId);
    if (!signingKey) {
      // Server-side gap (e.g. edge without the key yet). Not an attack — no throttle.
      return { ok: false, reason: 'KEY_UNAVAILABLE', deviceId: device.id };
    }
    const fingerprint = pinFingerprint(signingKey, input.pin);
    const staffPin = await this.pins.findActiveByRestaurantAndFingerprint(
      input.restaurantId,
      fingerprint,
    );
    if (!staffPin) {
      await this.registerFailure(device.id, input.restaurantId, input.branchId, state, now);
      return { ok: false, reason: 'NO_MATCH', deviceId: device.id };
    }

    // 4. The matched user must hold the required permission AT THIS BRANCH.
    const branchAccess = await this.access.resolveForBranch({
      organizationId: input.organizationId,
      restaurantId: input.restaurantId,
      userId: staffPin.userId,
      branchId: input.branchId,
    });
    if (!branchAccess.hasAccess || !branchAccess.permissions.includes(input.requiredPermission)) {
      await this.registerFailure(device.id, input.restaurantId, input.branchId, state, now);
      return { ok: false, reason: 'NO_CAPABILITY', deviceId: device.id };
    }

    // 5. Reuse the 3A primitive for the actual PIN/device/IP verification and the
    //    per-user lockout state machine. (A fingerprint match makes the argon2
    //    check a formality, but this keeps a single source of PIN-checking and
    //    re-applies the branch IP policy + records the device sighting.)
    const verified = await this.verifyPin.verify({
      deviceSecret: input.deviceSecret,
      userId: staffPin.userId,
      pin: input.pin,
      ip,
      allowedSurfaces: [DeviceSurface.POS],
    });
    if (!verified.ok) {
      await this.registerFailure(device.id, input.restaurantId, input.branchId, state, now);
      return { ok: false, reason: 'INVALID_PIN', deviceId: device.id };
    }

    // 6. Success — clear the device throttle and return the authorizer.
    await this.throttle.clear(device.id);
    return { ok: true, authorizerUserId: staffPin.userId, deviceId: device.id };
  }

  /**
   * Record one failed step-up against the device. If a previous lock window has
   * expired, start a fresh count; on hitting STEP_UP_MAX_ATTEMPTS, lock the
   * device's step-up for STEP_UP_LOCKOUT_MINUTES.
   */
  private async registerFailure(
    deviceId: string,
    restaurantId: string,
    branchId: string,
    prior: { failedAttempts: number; lockedUntil: Date | null } | null,
    now: Date,
  ): Promise<void> {
    const lockExpired = !!prior?.lockedUntil && prior.lockedUntil.getTime() <= now.getTime();
    const attempts = lockExpired ? 1 : (prior?.failedAttempts ?? 0) + 1;
    const locked = attempts >= this.maxAttempts();
    await this.throttle.save({
      deviceId,
      restaurantId,
      branchId,
      failedAttempts: attempts,
      lockedUntil: locked ? new Date(now.getTime() + this.lockoutMs()) : null,
    });
  }

  private maxAttempts(): number {
    return this.config.get('STEP_UP_MAX_ATTEMPTS', { infer: true });
  }

  private lockoutMs(): number {
    return this.config.get('STEP_UP_LOCKOUT_MINUTES', { infer: true }) * 60_000;
  }
}
