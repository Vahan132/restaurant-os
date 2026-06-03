import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { AccessTokenPayload } from '../../../shared/auth/jwt-payload';
import { AppConfig } from '../../../shared/infrastructure/config/env.schema';
import { PERMISSIONS } from '../../identity/domain/permissions.catalog';
import { PreparationStation } from '../../menu/domain/enums';
import {
  REALTIME_USER_READER,
  RealtimeUserReader,
} from '../application/ports/realtime-user.reader';
import { SocketAuthContext, restaurantRoom, stationRoom } from '../application/socket-context';

const VALID_STATIONS = new Set<string>(Object.values(PreparationStation));

/**
 * Real-time gateway (namespace "/realtime"). Sockets are liveness only — the
 * authoritative data lives behind HTTP; clients refetch on (re)connect.
 *
 * Connection auth: TENANT access token from handshake.auth.token, verified with
 * JWT_ACCESS_SECRET. Platform tokens (different secret) and invalid/blocked users
 * are rejected. On success the socket joins its restaurant room.
 */
@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly accessSecret: string;

  @WebSocketServer() server!: Namespace;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService<AppConfig, true>,
    @Inject(REALTIME_USER_READER) private readonly users: RealtimeUserReader,
  ) {
    this.accessSecret = config.get('JWT_ACCESS_SECRET', { infer: true });
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        return this.reject(client, 'missing token');
      }
      let payload: AccessTokenPayload;
      try {
        // Verifying with the TENANT secret also rejects platform tokens.
        payload = this.jwt.verify<AccessTokenPayload>(token, { secret: this.accessSecret });
      } catch {
        return this.reject(client, 'invalid token');
      }
      if (!payload.sub || !payload.organizationId || !payload.restaurantId) {
        return this.reject(client, 'missing restaurant context');
      }
      const active = await this.users.isActiveUser(payload.organizationId, payload.sub);
      if (!active) {
        return this.reject(client, 'blocked/unknown user');
      }
      const auth: SocketAuthContext = {
        userId: payload.sub,
        organizationId: payload.organizationId,
        restaurantId: payload.restaurantId,
        permissions: payload.permissions ?? [],
      };
      client.data.auth = auth;
      await client.join(restaurantRoom(auth.restaurantId));
      client.emit('realtime:connected', { restaurantId: auth.restaurantId });
    } catch (err) {
      this.logger.warn(`WS connection error: ${(err as Error).message}`);
      this.reject(client, 'internal');
    }
  }

  @SubscribeMessage('kds:subscribe')
  async subscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { stations?: string[] },
  ): Promise<{ ok: boolean; stations?: string[]; error?: string }> {
    const auth = client.data.auth as SocketAuthContext | undefined;
    if (!auth) {
      return { ok: false, error: 'UNAUTHENTICATED' };
    }
    if (!auth.permissions.includes(PERMISSIONS.KDS_ACCESS)) {
      return { ok: false, error: 'KDS_ACCESS_REQUIRED' };
    }
    const stations = (body?.stations ?? []).filter((s) => VALID_STATIONS.has(s));
    for (const station of stations) {
      await client.join(stationRoom(auth.restaurantId, station));
    }
    return { ok: true, stations };
  }

  @SubscribeMessage('kds:unsubscribe')
  async unsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { stations?: string[] },
  ): Promise<{ ok: boolean }> {
    const auth = client.data.auth as SocketAuthContext | undefined;
    if (!auth) {
      return { ok: false };
    }
    const stations = (body?.stations ?? []).filter((s) => VALID_STATIONS.has(s));
    for (const station of stations) {
      await client.leave(stationRoom(auth.restaurantId, station));
    }
    return { ok: true };
  }

  private extractToken(client: Socket): string | null {
    const fromAuth = (client.handshake.auth as { token?: string } | undefined)?.token;
    if (fromAuth) {
      return fromAuth;
    }
    const header = client.handshake.headers?.authorization;
    if (header?.startsWith('Bearer ')) {
      return header.slice('Bearer '.length);
    }
    return null;
  }

  private reject(client: Socket, reason: string): void {
    this.logger.debug(`WS rejected (${reason})`);
    client.emit('realtime:error', { reason });
    client.disconnect(true);
  }
}
