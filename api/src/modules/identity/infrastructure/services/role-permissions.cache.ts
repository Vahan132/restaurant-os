import { Inject, Injectable, Logger } from '@nestjs/common';
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
 */
@Injectable()
export class RolePermissionsCache {
  private readonly logger = new Logger(RolePermissionsCache.name);
  private static readonly TTL_SECONDS = 300;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
  ) {}

  private key(roleId: string): string {
    return `role:${roleId}:permissions`;
  }

  /** Effective permission snapshot for a role (Redis-cached, DB-backed). */
  async get(organizationId: string, roleId: string): Promise<string[]> {
    try {
      const cached = await this.redis.get(this.key(roleId));
      if (cached) {
        return JSON.parse(cached) as string[];
      }
    } catch (err) {
      this.logger.warn(`cache read failed for ${roleId}: ${(err as Error).message}`);
    }

    const role = await this.roles.findById(organizationId, roleId);
    const permissions = snapshotPermissionsForRole(role);

    // Only cache a real hit; a missing role stays uncached so a later create
    // isn't shadowed by an empty entry.
    if (role) {
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
    try {
      await this.redis.del(this.key(roleId));
    } catch (err) {
      this.logger.warn(`cache invalidate failed for ${roleId}: ${(err as Error).message}`);
    }
  }
}
