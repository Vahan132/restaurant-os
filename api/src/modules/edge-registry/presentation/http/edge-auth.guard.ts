import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { InvalidNodeToken } from '../../application/edge-registry.errors';
import { hashNodeToken } from '../../application/edge-token.util';
import {
  EDGE_NODE_REPOSITORY,
  EdgeNodeRepository,
} from '../../domain/repositories/edge-node.repository';
import { EdgeNodeContext } from './edge-node-context';

/**
 * EdgeAuthGuard (cloud) — authenticates a request by a bearer NODE token (NOT a
 * user JWT). The route must be @Public() so the global JWT/Tenant guards skip it.
 * Resolves the ACTIVE EdgeNode by sha256(token); the tenant + branch come from
 * the node, never the body. Unknown/revoked/missing tokens get a 401. Updates
 * lastSeenAt on success.
 */
@Injectable()
export class EdgeAuthGuard implements CanActivate {
  constructor(@Inject(EDGE_NODE_REPOSITORY) private readonly nodes: EdgeNodeRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearer(request);
    if (!token) {
      throw InvalidNodeToken();
    }

    const node = await this.nodes.findActiveByTokenHash(hashNodeToken(token));
    if (!node) {
      throw InvalidNodeToken();
    }

    await this.nodes.touchLastSeen(node.id, new Date());

    const principal: EdgeNodeContext = {
      nodeId: node.id,
      organizationId: node.organizationId,
      restaurantId: node.restaurantId,
      branchId: node.branchId,
    };
    request.edgeNode = principal;
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
