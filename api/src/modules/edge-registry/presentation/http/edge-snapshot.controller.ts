import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/public.decorator';
import { ConfigChanges } from '../../../../shared/edge/contracts/config-sync.contract';
import { BranchSnapshot } from '../../../../shared/edge/contracts/snapshot.contract';
import { GetBranchSnapshotUseCase } from '../../application/queries/get-branch-snapshot.usecase';
import { GetConfigChangesUseCase } from '../../application/queries/get-config-changes.usecase';
import { CurrentEdgeNode, EdgeNodeContext } from './edge-node-context';
import { EdgeAuthGuard } from './edge-auth.guard';
import { SchemaVersionGuard } from './schema-version.guard';

/**
 * Branch snapshot — authenticated by a bearer NODE token (NOT a user JWT).
 * @Public() bypasses the global JWT/Tenant guards; EdgeAuthGuard resolves the
 * node + tenant/branch, then SchemaVersionGuard (OFF-8) rejects a hub on an
 * incompatible edge schema (SCHEMA_MISMATCH 426) to prevent a corrupt sync.
 * Returns ONLY the node's branch slice, with cloud ids preserved. This is the
 * only way branch data reaches the edge.
 */
@ApiTags('edge')
@Public()
@ApiSecurity('edge-node-token')
@UseGuards(EdgeAuthGuard, SchemaVersionGuard)
@Controller('edge')
export class EdgeSnapshotController {
  constructor(
    private readonly getSnapshot: GetBranchSnapshotUseCase,
    private readonly getConfigChanges: GetConfigChangesUseCase,
  ) {}

  @Get('snapshot')
  @ApiOperation({ summary: "Versioned snapshot of the node's branch (node-token auth)." })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or revoked node token.' })
  async snapshot(@CurrentEdgeNode() node: EdgeNodeContext): Promise<BranchSnapshot> {
    return this.getSnapshot.execute({
      nodeId: node.nodeId,
      organizationId: node.organizationId,
      restaurantId: node.restaurantId,
      branchId: node.branchId,
    });
  }

  @Get('config-sync')
  @ApiOperation({
    summary: "Incremental CONFIG changes for the node's branch since a cursor (node-token auth).",
  })
  @ApiQuery({
    name: 'since',
    required: false,
    description: 'ISO-8601 cursor; omit for a full pull.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or revoked node token.' })
  async configSync(
    @CurrentEdgeNode() node: EdgeNodeContext,
    @Query('since') since?: string,
  ): Promise<ConfigChanges> {
    return this.getConfigChanges.execute({
      nodeId: node.nodeId,
      organizationId: node.organizationId,
      restaurantId: node.restaurantId,
      branchId: node.branchId,
      since,
    });
  }
}
