import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from '../presentation/realtime.gateway';
import { restaurantRoom, stationRoom } from './socket-context';

/**
 * Broadcasts to Socket.IO rooms via the gateway's namespace server. With the
 * Redis adapter wired, `.to(room).emit(...)` fans out across all API instances.
 */
@Injectable()
export class RealtimePublisher {
  constructor(private readonly gateway: RealtimeGateway) {}

  emitToRestaurant(restaurantId: string, event: string, payload: unknown): void {
    this.gateway.server?.to(restaurantRoom(restaurantId)).emit(event, payload);
  }

  emitToStation(restaurantId: string, station: string, event: string, payload: unknown): void {
    this.gateway.server?.to(stationRoom(restaurantId, station)).emit(event, payload);
  }
}
