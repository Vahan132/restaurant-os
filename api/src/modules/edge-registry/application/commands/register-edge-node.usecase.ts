import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { EdgeNode } from '../../domain/entities/edge-node';
import {
  EDGE_NODE_REPOSITORY,
  EdgeNodeRepository,
} from '../../domain/repositories/edge-node.repository';
import { BRANCH_LOOKUP, BranchLookup } from '../ports/branch-lookup.port';
import { BranchNotInRestaurant, NoRestaurantInScope } from '../edge-registry.errors';
import { generateNodeToken, hashNodeToken } from '../edge-token.util';

export interface RegisterEdgeNodeInput {
  organizationId: string;
  restaurantId: string | null;
  branchId: string;
  name: string;
  createdByUserId: string;
}

export interface RegisterEdgeNodeResult {
  node: EdgeNode;
  /** Plaintext token — returned ONCE; only its sha256 hash is persisted. */
  token: string;
}

/**
 * Register an edge node for a branch. Mints a random bearer token, stores only
 * sha256(token), and returns the plaintext exactly once for the operator to
 * install on the hub.
 */
@Injectable()
export class RegisterEdgeNodeUseCase implements UseCase<
  RegisterEdgeNodeInput,
  RegisterEdgeNodeResult
> {
  constructor(
    @Inject(EDGE_NODE_REPOSITORY) private readonly nodes: EdgeNodeRepository,
    @Inject(BRANCH_LOOKUP) private readonly branches: BranchLookup,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: RegisterEdgeNodeInput): Promise<RegisterEdgeNodeResult> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const branchOk = await this.branches.existsActive(input.restaurantId, input.branchId);
    if (!branchOk) {
      throw BranchNotInRestaurant();
    }

    const token = generateNodeToken();
    const node = EdgeNode.create({
      id: this.ids.generate(),
      organizationId: input.organizationId,
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      name: input.name,
      tokenHash: hashNodeToken(token),
      createdByUserId: input.createdByUserId,
    });
    await this.nodes.create(node);
    return { node, token };
  }
}
