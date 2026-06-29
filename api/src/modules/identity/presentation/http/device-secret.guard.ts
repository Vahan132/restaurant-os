import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { InvalidDeviceSecret } from '../../application/application.errors';
import { DEVICE_REPOSITORY, DeviceRepository } from '../../domain/repositories/device.repository';
import { hashDeviceSecret } from '../../infrastructure/services/device-secret.util';
import { DeviceAuthContext } from './device-secret-context';

/**
 * DeviceSecretGuard — authenticates a POS/KDS surface by the `X-Device-Secret`
 * header (NOT a user JWT) so it can fetch the staff picker BEFORE any user logs
 * in. The route must be @Public() so the global JWT/Tenant guards skip it. The
 * tenant is taken from the resolved ACTIVE device, never from the request.
 */
@Injectable()
export class DeviceSecretGuard implements CanActivate {
  constructor(@Inject(DEVICE_REPOSITORY) private readonly devices: DeviceRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const secret = this.extractSecret(request);
    if (!secret) {
      throw InvalidDeviceSecret();
    }
    const device = await this.devices.findActiveBySecretHash(hashDeviceSecret(secret));
    if (!device || !device.isActive()) {
      throw InvalidDeviceSecret();
    }
    const principal: DeviceAuthContext = {
      deviceId: device.id,
      restaurantId: device.restaurantId,
      branchId: device.branchId,
      surface: device.surface,
    };
    request.deviceAuth = principal;
    return true;
  }

  private extractSecret(request: Request): string | null {
    const header = request.headers['x-device-secret'];
    if (typeof header === 'string' && header.length > 0) {
      return header;
    }
    return null;
  }
}
