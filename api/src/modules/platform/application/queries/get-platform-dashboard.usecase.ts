import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  PLATFORM_ADMIN_QUERY,
  PlatformAdminQuery,
  PlatformDashboard,
} from '../ports/platform-admin-query.port';

@Injectable()
export class GetPlatformDashboardUseCase implements UseCase<void, PlatformDashboard> {
  constructor(@Inject(PLATFORM_ADMIN_QUERY) private readonly query: PlatformAdminQuery) {}
  execute(): Promise<PlatformDashboard> {
    return this.query.dashboard();
  }
}
