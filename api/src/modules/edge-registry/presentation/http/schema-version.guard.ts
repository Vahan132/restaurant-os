import { CanActivate, ExecutionContext, Inject, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { EDGE_SCHEMA_VERSION_HEADER, SCHEMA_VERSION } from '../../../../shared/edge/version';
import { SchemaMismatch } from '../../application/edge-registry.errors';
import {
  EDGE_NODE_REPOSITORY,
  EdgeNodeRepository,
} from '../../domain/repositories/edge-node.repository';

/**
 * SchemaVersionGuard (cloud, OFF-8) — guards the sync endpoints (snapshot,
 * config-sync, push) against a hub running an incompatible edge schema version.
 * MUST run AFTER EdgeAuthGuard (it reads the resolved node from the request).
 *
 * If the hub's `x-edge-schema-version` header differs from the cloud's
 * SCHEMA_VERSION constant, it records the mismatch on the node (so an admin sees
 * it) and rejects with SCHEMA_MISMATCH (426). A missing header is allowed (a
 * pre-OFF-8 hub that does not yet speak the protocol); a matching header passes.
 */
@Injectable()
export class SchemaVersionGuard implements CanActivate {
  private readonly logger = new Logger(SchemaVersionGuard.name);

  constructor(@Inject(EDGE_NODE_REPOSITORY) private readonly nodes: EdgeNodeRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const reported = this.headerValue(request, EDGE_SCHEMA_VERSION_HEADER);

    // No header → cannot compare; let it through (EdgeAuthGuard already authn'd).
    if (reported === null) {
      return true;
    }
    if (reported === SCHEMA_VERSION) {
      return true;
    }

    // Record the mismatch on the node so admins see it even between heartbeats.
    const node = request.edgeNode;
    if (node) {
      try {
        const entity = await this.nodes.findById(node.restaurantId, node.nodeId);
        if (entity) {
          entity.markSchemaMismatch(reported);
          await this.nodes.save(entity);
        }
      } catch (err) {
        // Best-effort: never let bookkeeping mask the real 426.
        this.logger.warn(
          `Failed to record schema mismatch on node ${node.nodeId}: ${(err as Error).message}`,
        );
      }
    }

    throw SchemaMismatch(SCHEMA_VERSION, reported);
  }

  private headerValue(request: Request, name: string): string | null {
    const raw = request.headers[name];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value && value.trim() !== '' ? value.trim() : null;
  }
}
