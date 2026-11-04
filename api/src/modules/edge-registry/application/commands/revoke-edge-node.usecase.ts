import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  EDGE_NODE_REPOSITORY,
  EdgeNodeRepository,
} from '../../domain/repositories/edge-node.repository';
import { EdgeNodeNotFound, NoRestaurantInScope } from '../edge-registry.errors';

export interface RevokeEdgeNodeInput {
  restaurantId: string | null;
  nodeId: string;
}

/** Revoke an edge node — idempotent; a revoked node can no longer authenticate. */
@Injectable()
export class RevokeEdgeNodeUseCase implements UseCase<RevokeEdgeNodeInput, void> {
  constructor(@Inject(EDGE_NODE_REPOSITORY) private readonly nodes: EdgeNodeRepository) {}

  async execute(input: RevokeEdgeNodeInput): Promise<void> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const node = await this.nodes.findById(input.restaurantId, input.nodeId);
    if (!node) {
      throw EdgeNodeNotFound();
    }
    node.revoke();
    await this.nodes.save(node);
  }
}
