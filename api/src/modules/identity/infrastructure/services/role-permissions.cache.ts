import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../../shared/infrastructure/redis/redis.tokens';
import { snapshotPermissionsForRole } from '../../domain/permissions.catalog';
import { ROLE_REPOSITORY, RoleRepository } from '../../domain/repositories/role.repository';

/**
 * Server-side source of a role's effective permission snapshot, cached in Redis
 * under `role:{roleId}:permissions` and invalidated by the update-role use-case.
 *
 * Authorization must NEVER read the (frozen) JWT permission snapshot; the guard
 * resolves the caller's current permissions from their roleId through here, so a
 * permission edit takes effect without re-login. Redis failures degrade to a
 * direct DB read — the cache is an optimization, never a correctness gate.
 *
 * EDGE mode runs WITHOUT Redis (RedisModule is excluded in app.module.ts), so
 * REDIS_CLIENT is injected OPTIONALLY. When it is absent the cache is simply
 * bypassed and every resolve reads straight from the DB — the exact same
 * graceful-degradation path taken on a Redis failure. The cache is never a
 * correctness gate, so a hub with no Redis is fully correct, just un-cached.
 */
@Injectable()
export class RolePermissionsCache {
  private readonly logger = new Logger(RolePermissionsCache.name);
  private static readonly TTL_SECONDS = 300;

  constructor(
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
  ) {
    if (!this.redis) {
      this.logger.log(
        'No Redis client (edge/no-cache mode) — role permissions resolve directly from the DB.',
      );
    }
  }

  private key(roleId: string): string {
    return `role:${roleId}:permissions`;
  }

  /** Effective permission snapshot for a role (Redis-cached, DB-backed). */
  async get(organizationId: string, roleId: string): Promise<string[]> {
    if (this.redis) {
      try {
        const cached = await this.redis.get(this.key(roleId));
        if (cached) {
          return JSON.parse(cached) as string[];
        }
      } catch (err) {
        this.logger.warn(`cache read failed for ${roleId}: ${(err as Error).message}`);
      }
    }

    const role = await this.roles.findById(organizationId, roleId);
    const permissions = snapshotPermissionsForRole(role);

    // Only cache a real hit; a missing role stays uncached so a later create
    // isn't shadowed by an empty entry. Skipped entirely when there is no Redis.
    if (role && this.redis) {
      try {
        await this.redis.set(
          this.key(roleId),
          JSON.stringify(permissions),
          'EX',
          RolePermissionsCache.TTL_SECONDS,
        );
      } catch (err) {
        this.logger.warn(`cache write failed for ${roleId}: ${(err as Error).message}`);
      }
    }
    return permissions;
  }

  /** Drop the cached snapshot so the next resolve reloads from the DB. */
  async invalidate(roleId: string): Promise<void> {
    if (!this.redis) {
      return;
    }
    try {
      await this.redis.del(this.key(roleId));
    } catch (err) {
      this.logger.warn(`cache invalidate failed for ${roleId}: ${(err as Error).message}`);
    }
  }
}
