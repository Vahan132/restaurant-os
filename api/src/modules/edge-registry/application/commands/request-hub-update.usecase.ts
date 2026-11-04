import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  EDGE_NODE_REPOSITORY,
  EdgeNodeRepository,
} from '../../domain/repositories/edge-node.repository';
import { EdgeNodeNotFound, NoRestaurantInScope } from '../edge-registry.errors';

export interface RequestHubUpdateInput {
  restaurantId: string | null;
  nodeId: string;
}

/**
 * EDGE-UPDATE-1 — "Update now" on the Hubs page. Stamps updateRequestedAt on the
 * node; the next heartbeat reply carries it, the hub drops an update-request file
 * on its data volume, and the hub's updater container pulls the newer images and
 * recreates the changed containers in place (no reinstall, data kept).
 */
@Injectable()
export class RequestHubUpdateUseCase implements UseCase<RequestHubUpdateInput, Date> {
  constructor(@Inject(EDGE_NODE_REPOSITORY) private readonly nodes: EdgeNodeRepository) {}

  async execute(input: RequestHubUpdateInput): Promise<Date> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const node = await this.nodes.findById(input.restaurantId, input.nodeId);
    if (!node || !node.isActive()) {
      throw EdgeNodeNotFound();
    }
    const at = new Date();
    node.requestUpdate(at);
    await this.nodes.save(node);
    return at;
  }
}
