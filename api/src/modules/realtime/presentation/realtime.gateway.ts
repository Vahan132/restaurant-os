import { Inject, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import {
  BRANCH_ACCESS_RESOLVER,
  BranchAccessResolver,
} from '../../../shared/auth/branch-access.resolver';
import { AccessTokenPayload } from '../../../shared/auth/jwt-payload';
import { EdgeConfigService } from '../../../shared/edge/edge-config.service';
import {
  RESTAURANT_KEY_PROVIDER,
  RestaurantKeyProvider,
} from '../../identity/application/ports/restaurant-key.provider';
import { TOKEN_SERVICE, TokenService } from '../../identity/application/ports/token.service';
import { PERMISSIONS } from '../../identity/domain/permissions.catalog';
import { PreparationStation } from '../../menu/domain/enums';
import {
  REALTIME_USER_READER,
  RealtimeUserReader,
} from '../application/ports/realtime-user.reader';
import { SocketAuthContext, branchRoom, orgRoom, stationRoom } from '../application/socket-context';

const VALID_STATIONS = new Set<string>(Object.values(PreparationStation));

/** Body accepted by kds:subscribe / kds:unsubscribe. */
interface StationSubscription {
  stations?: string[];
  /** Single-station kiosks (the KDS pins exactly one) may send this instead. */
  station?: string;
}

/**
 * Normalize a subscription body to the set of valid stations it names. Accepts
 * both the plural `stations` array and a singular `station` string so a kiosk
 * pinned to one station is never silently filtered down to an empty list.
 */
function readStations(body: StationSubscription | undefined): string[] {
  const raw = [...(body?.stations ?? []), ...(body?.station ? [body.station] : [])];
  return [...new Set(raw.filter((s) => VALID_STATIONS.has(s)))];
}

/**
 * Real-time gateway (namespace "/realtime"). Sockets are liveness only — the
 * authoritative data lives behind HTTP; clients refetch on (re)connect.
 *
 * Connection auth: TENANT access token from handshake.auth.token, verified with
 * the per-restaurant key (OFF-5) so cloud- or edge-issued tokens both work.
 * BR-5: the socket is bound to ONE active branch, read from
 * handshake.auth.branchId (or ?branchId), defaulting to the caller's default
 * branch when absent. Branch access is validated on connect (BRANCH_ACCESS_DENIED
 * otherwise) and the socket's permissions are the EFFECTIVE permissions at that
 * branch. The socket joins only its branch room (+ accessible station rooms).
 */
@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer() server!: Namespace;

  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    @Inject(RESTAURANT_KEY_PROVIDER) private readonly keys: RestaurantKeyProvider,
    @Inject(REALTIME_USER_READER) private readonly users: RealtimeUserReader,
    @Inject(BRANCH_ACCESS_RESOLVER) private readonly branchAccess: BranchAccessResolver,
    private readonly edge: EdgeConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        return this.reject(client, 'missing token');
      }
      // OFF-5: resolve the per-restaurant key from the (unverified) claim, then
      // verify. Verifying with the tenant key also rejects platform tokens.
      const restaurantId = this.tokens.decodeRestaurantId(token);
      const signingKey = await this.keys.getSigningKey(restaurantId);
      if (!signingKey) {
        return this.reject(client, 'invalid token');
      }
      let payload: AccessTokenPayload;
      try {
        payload = this.tokens.verifyAccessToken(token, signingKey);
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

      // EDGE mode (OFF-1): pin to this hub's single org/restaurant/branch. A
      // token for another tenant is rejected; a requested branch must match the
      // edge branch (else treated as no access).
      let requested = this.extractBranchId(client);
      if (this.edge.isEdge) {
        const identity = this.edge.getIdentity();
        if (
          payload.organizationId !== identity.organizationId ||
          payload.restaurantId !== identity.restaurantId
        ) {
          return this.reject(client, 'EDGE_TENANT_MISMATCH');
        }
        if (requested && requested !== identity.branchId) {
          return this.reject(client, 'BRANCH_ACCESS_DENIED');
        }
        requested = identity.branchId;
      }

      // BR-5: resolve + validate the active branch.
      let branchId: string;
      let permissions: string[];
      if (requested) {
        const res = await this.branchAccess.resolveForBranch({
          organizationId: payload.organizationId,
          restaurantId: payload.restaurantId,
          userId: payload.sub,
          branchId: requested,
        });
        if (!res.branchExists || !res.hasAccess) {
          return this.reject(client, 'BRANCH_ACCESS_DENIED');
        }
        branchId = requested;
        permissions = res.permissions;
      } else {
        const fallback = await this.branchAccess.resolveDefaultBranchAccess({
          organizationId: payload.organizationId,
          restaurantId: payload.restaurantId,
          userId: payload.sub,
        });
        if (!fallback) {
          return this.reject(client, 'no accessible branch');
        }
        branchId = fallback.branchId;
        permissions = fallback.permissions;
      }

      const auth: SocketAuthContext = {
        userId: payload.sub,
        organizationId: payload.organizationId,
        restaurantId: payload.restaurantId,
        branchId,
        permissions,
      };
      client.data.auth = auth;
      await client.join(branchRoom(auth.restaurantId, auth.branchId));
      // Also join the org room so cross-branch, tenant-scoped events (e.g. a
      // role's permissions changing) reach this session regardless of branch.
      await client.join(orgRoom(auth.organizationId));
      client.emit('realtime:connected', {
        restaurantId: auth.restaurantId,
        branchId: auth.branchId,
      });
    } catch (err) {
      this.logger.warn(`WS connection error: ${(err as Error).message}`);
      this.reject(client, 'internal');
    }
  }

  @SubscribeMessage('kds:subscribe')
  async subscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: StationSubscription,
  ): Promise<{ ok: boolean; stations?: string[]; error?: string }> {
    const auth = client.data.auth as SocketAuthContext | undefined;
    if (!auth) {
      return { ok: false, error: 'UNAUTHENTICATED' };
    }
    // Effective permissions at the active branch gate KDS access.
    if (!auth.permissions.includes(PERMISSIONS.KDS_ACCESS)) {
      return { ok: false, error: 'KDS_ACCESS_REQUIRED' };
    }
    const stations = readStations(body);
    for (const station of stations) {
      await client.join(stationRoom(auth.restaurantId, auth.branchId, station));
    }
    return { ok: true, stations };
  }

  @SubscribeMessage('kds:unsubscribe')
  async unsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: StationSubscription,
  ): Promise<{ ok: boolean }> {
    const auth = client.data.auth as SocketAuthContext | undefined;
    if (!auth) {
      return { ok: false };
    }
    const stations = readStations(body);
    for (const station of stations) {
      await client.leave(stationRoom(auth.restaurantId, auth.branchId, station));
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

  private extractBranchId(client: Socket): string | null {
    const fromAuth = (client.handshake.auth as { branchId?: string } | undefined)?.branchId;
    if (fromAuth) {
      return fromAuth;
    }
    const q = client.handshake.query?.branchId;
    if (typeof q === 'string' && q) {
      return q;
    }
    return null;
  }

  private reject(client: Socket, reason: string): void {
    this.logger.debug(`WS rejected (${reason})`);
    client.emit('realtime:error', { reason });
    client.disconnect(true);
  }
}
