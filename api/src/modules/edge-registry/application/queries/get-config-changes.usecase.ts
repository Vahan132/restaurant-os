import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ConfigChanges } from '../../../../shared/edge/contracts/config-sync.contract';
import { EDGE_READ_MODEL, EdgeReadModel } from '../ports/edge-read-model';
import { InvalidCursor } from '../edge-registry.errors';

export interface GetConfigChangesInput {
  /** Authenticated hub node id (EDGE-KEK-1 per-hub fiscal DEK re-wrap). */
  nodeId: string;
  organizationId: string;
  restaurantId: string;
  branchId: string;
  /** Raw `since` query param (ISO-8601), or undefined for a full config pull. */
  since?: string;
}

/**
 * Build the incremental config changes for the node's branch since `since`.
 * Validates the cursor; the tenant/branch come from the authenticated node.
 */
@Injectable()
export class GetConfigChangesUseCase implements UseCase<GetConfigChangesInput, ConfigChanges> {
  constructor(@Inject(EDGE_READ_MODEL) private readonly readModel: EdgeReadModel) {}

  async execute(input: GetConfigChangesInput): Promise<ConfigChanges> {
    let since: Date | null = null;
    if (input.since !== undefined && input.since !== '') {
      const parsed = new Date(input.since);
      if (Number.isNaN(parsed.getTime())) {
        throw InvalidCursor();
      }
      since = parsed;
    }
    return this.readModel.buildConfigChanges(
      {
        nodeId: input.nodeId,
        organizationId: input.organizationId,
        restaurantId: input.restaurantId,
        branchId: input.branchId,
      },
      since,
    );
  }
}
