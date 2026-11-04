import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { EdgeNode } from '../../domain/entities/edge-node';
import {
  EDGE_NODE_REPOSITORY,
  EdgeNodeRepository,
} from '../../domain/repositories/edge-node.repository';
import { NoRestaurantInScope } from '../edge-registry.errors';

/** List the edge nodes registered for the caller's restaurant. */
@Injectable()
export class ListEdgeNodesUseCase implements UseCase<{ restaurantId: string | null }, EdgeNode[]> {
  constructor(@Inject(EDGE_NODE_REPOSITORY) private readonly nodes: EdgeNodeRepository) {}

  async execute(input: { restaurantId: string | null }): Promise<EdgeNode[]> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    return this.nodes.list(input.restaurantId);
  }
}
