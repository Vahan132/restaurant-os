import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { AppConfig } from '../../../../shared/infrastructure/config/env.schema';
import { APP_VERSION, SCHEMA_VERSION } from '../../../../shared/edge/version';
import { RegisterEdgeNodeUseCase } from '../../application/commands/register-edge-node.usecase';
import { RevokeEdgeNodeUseCase } from '../../application/commands/revoke-edge-node.usecase';
import { ListEdgeNodesUseCase } from '../../application/queries/list-edge-nodes.usecase';
import {
  EdgeNodeResponse,
  EdgeNodeViewContext,
  RegisterEdgeNodeDto,
  RegisterEdgeNodeResponse,
} from '../../application/dto/edge-node.dto';

/**
 * Edge node registry — RESTAURANT-LEVEL admin surface (NOT @BranchScoped). Gated
 * by the restaurant-wide EDGE_MANAGE permission. Tenant + actor come from the
 * verified JWT; branchId is supplied in the body and validated server-side.
 */
@ApiTags('edge-nodes')
@Controller('edge-nodes')
@RequirePermissions(PERMISSIONS.EDGE_MANAGE)
export class EdgeNodesController {
  constructor(
    private readonly register: RegisterEdgeNodeUseCase,
    private readonly list: ListEdgeNodesUseCase,
    private readonly revoke: RevokeEdgeNodeUseCase,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Resolve the live-view context (offline threshold + expected versions). */
  private viewContext(): EdgeNodeViewContext {
    return {
      offlineThresholdMs: this.config.get('EDGE_OFFLINE_THRESHOLD_MS', { infer: true }),
      expectedSchemaVersion: SCHEMA_VERSION,
      expectedAppVersion: APP_VERSION,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Register an edge node for a branch (returns the token ONCE).' })
  @ApiCreatedResponse({ type: RegisterEdgeNodeResponse })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Body() dto: RegisterEdgeNodeDto,
  ): Promise<RegisterEdgeNodeResponse> {
    const { node, token } = await this.register.execute({
      organizationId: tenant.organizationId,
      restaurantId: tenant.restaurantId,
      branchId: dto.branchId,
      name: dto.name,
      createdByUserId: user.sub,
    });
    return RegisterEdgeNodeResponse.fromNode(node, token, this.viewContext());
  }

  @Get()
  @ApiOperation({ summary: 'List edge nodes for the restaurant.' })
  @ApiOkResponse({ type: EdgeNodeResponse, isArray: true })
  async listNodes(@CurrentTenant() tenant: TenantContext): Promise<EdgeNodeResponse[]> {
    const nodes = await this.list.execute({ restaurantId: tenant.restaurantId });
    const ctx = this.viewContext();
    return nodes.map((node) => EdgeNodeResponse.from(node, ctx));
  }

  @Post(':id/revoke')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke an edge node (idempotent).' })
  async revokeNode(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<void> {
    await this.revoke.execute({ restaurantId: tenant.restaurantId, nodeId: id });
  }
}
