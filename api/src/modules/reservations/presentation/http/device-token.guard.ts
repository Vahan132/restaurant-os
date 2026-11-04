import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { hashDeviceToken } from '../../application/commands/register-call-device.usecase';
import { InvalidDeviceToken } from '../../application/application.errors';
import {
  CALL_DEVICE_REPOSITORY,
  CallDeviceRepository,
} from '../../domain/repositories/call-device.repository';
import { DeviceContext } from './device-context';

/**
 * DeviceTokenGuard — authenticates the Android companion by a bearer DEVICE
 * token (NOT a user JWT). The route must be @Public() so the global JWT/Tenant
 * guards skip it. Resolves the ACTIVE CallDevice by sha256(token); the tenant is
 * taken from the device, never from the body. Unknown/revoked/missing tokens get
 * a 401. Updates lastSeenAt on success.
 */
@Injectable()
export class DeviceTokenGuard implements CanActivate {
  constructor(@Inject(CALL_DEVICE_REPOSITORY) private readonly devices: CallDeviceRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearer(request);
    if (!token) {
      throw InvalidDeviceToken();
    }

    const device = await this.devices.findActiveByTokenHash(hashDeviceToken(token));
    if (!device) {
      throw InvalidDeviceToken();
    }

    const now = new Date();
    await this.devices.touchLastSeen(device.id, now);

    const principal: DeviceContext = {
      deviceId: device.id,
      restaurantId: device.restaurantId,
      branchId: device.branchId,
    };
    request.device = principal;
    return true;
  }

  private extractBearer(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) {
      return null;
    }
    const [scheme, value] = header.split(' ');
    return scheme === 'Bearer' && value ? value : null;
  }
}
