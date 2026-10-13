import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { BranchSnapshot } from '../../../../shared/edge/contracts/snapshot.contract';
import {
  EDGE_NODE_REPOSITORY,
  EdgeNodeRepository,
} from '../../domain/repositories/edge-node.repository';
import { EDGE_READ_MODEL, EdgeReadModel } from '../ports/edge-read-model';

export interface GetBranchSnapshotInput {
  nodeId: string;
  organizationId: string;
  restaurantId: string;
  branchId: string;
}

/**
 * Build the node's branch snapshot and stamp lastSnapshotAt + schemaVersion on
 * the node. The tenant/branch come from the authenticated node, never the body.
 */
@Injectable()
export class GetBranchSnapshotUseCase implements UseCase<GetBranchSnapshotInput, BranchSnapshot> {
  constructor(
    @Inject(EDGE_READ_MODEL) private readonly readModel: EdgeReadModel,
    @Inject(EDGE_NODE_REPOSITORY) private readonly nodes: EdgeNodeRepository,
  ) {}

  async execute(input: GetBranchSnapshotInput): Promise<BranchSnapshot> {
    const snapshot = await this.readModel.buildBranchSnapshot({
      nodeId: input.nodeId,
      organizationId: input.organizationId,
      restaurantId: input.restaurantId,
      branchId: input.branchId,
    });
    await this.nodes.recordSnapshot(input.nodeId, new Date(), snapshot.meta.schemaVersion);
    return snapshot;
  }
}
