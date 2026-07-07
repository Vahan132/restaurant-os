import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from '../presentation/realtime.gateway';
import { branchRoom, orgRoom, stationRoom } from './socket-context';

/**
 * Broadcasts to Socket.IO rooms via the gateway's namespace server. With the
 * Redis adapter wired, `.to(room).emit(...)` fans out across all API instances
 * (room names are global across the adapter, so multi-instance still works).
 *
 * BR-5: targeting is per-BRANCH. There is no restaurant-wide broadcast anymore.
 */
@Injectable()
export class RealtimePublisher {
  constructor(private readonly gateway: RealtimeGateway) {}

  emitToBranch(restaurantId: string, branchId: string, event: string, payload: unknown): void {
    this.gateway.server?.to(branchRoom(restaurantId, branchId)).emit(event, payload);
  }

  emitToStation(
    restaurantId: string,
    branchId: string,
    station: string,
    event: string,
    payload: unknown,
  ): void {
    this.gateway.server?.to(stationRoom(restaurantId, branchId, station)).emit(event, payload);
  }

  /** Cross-branch, tenant-scoped broadcast (e.g. role permission changes). */
  emitToOrg(organizationId: string, event: string, payload: unknown): void {
    this.gateway.server?.to(orgRoom(organizationId)).emit(event, payload);
  }
}
