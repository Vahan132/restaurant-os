import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { AppConfig } from '../../../../shared/infrastructure/config/env.schema';
import { APP_VERSION, SCHEMA_VERSION } from '../../../../shared/edge/version';
import { IssuePairingCodeUseCase } from '../../application/commands/issue-pairing-code.usecase';
import { RegisterEdgeNodeUseCase } from '../../application/commands/register-edge-node.usecase';
import { RevokeEdgeNodeUseCase } from '../../application/commands/revoke-edge-node.usecase';
import { ListEdgeNodesUseCase } from '../../application/queries/list-edge-nodes.usecase';
import {
  EdgeNodeResponse,
  EdgeNodeViewContext,
  RegisterEdgeNodeDto,
  RegisterEdgeNodeResponse,
} from '../../application/dto/edge-node.dto';
import { IssuePairingCodeDto, PairingCodeResponse } from '../../application/dto/pairing.dto';
import { ProvisionHubDto, ProvisionHubResponse } from '../../application/dto/provision.dto';
import { buildHubBundle } from '../../application/hub-bundle.builder';

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
    private readonly issuePairingCode: IssuePairingCodeUseCase,
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

  @Post('provision')
  @ApiOperation({
    summary:
      'Provision a hub for a branch: register the node and return a ready-to-run ' +
      'bundle (filled .env.edge + run scripts). Secrets are shown ONCE.',
  })
  @ApiCreatedResponse({ type: ProvisionHubResponse })
  async provision(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Body() dto: ProvisionHubDto,
  ): Promise<ProvisionHubResponse> {
    const { node, token } = await this.register.execute({
      organizationId: tenant.organizationId,
      restaurantId: tenant.restaurantId,
      branchId: dto.branchId,
      name: dto.name,
      createdByUserId: user.sub,
    });
    const secret = () => randomBytes(24).toString('hex');
    const files = buildHubBundle({
      organizationId: node.organizationId,
      restaurantId: node.restaurantId,
      branchId: node.branchId,
      nodeId: node.id,
      nodeToken: token,
      cloudUrl: dto.cloudUrl?.trim() || undefined,
      dbPassword: randomBytes(16).toString('hex'),
      jwtAccess: secret(),
      jwtRefresh: secret(),
      platformAccess: secret(),
      platformRefresh: secret(),
      consumerAccess: secret(),
      consumerRefresh: secret(),
      posDeviceSecret: secret(),
      kdsDeviceSecret: secret(),
    });
    const safe = dto.name.replace(/[^a-zA-Z0-9-_]+/g, '-').toLowerCase() || 'hub';
    return {
      nodeId: node.id,
      branchId: node.branchId,
      name: dto.name,
      bundleName: `restaurant-os-hub-${safe}.zip`,
      files,
    };
  }

  @Post('pairing-code')
  // EDGE-PAIR-3: authenticated (EDGE_MANAGE) issuance — lower risk, so a generous
  // per-IP cap that never blocks normal admin use but bounds automated abuse.
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Issue a single-use pairing code for a branch (returns the code ONCE).',
  })
  @ApiCreatedResponse({ type: PairingCodeResponse })
  @ApiTooManyRequestsResponse({ description: 'Too many pairing-code requests — wait a moment.' })
  async pairingCode(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Body() dto: IssuePairingCodeDto,
  ): Promise<PairingCodeResponse> {
    const { code, expiresAt } = await this.issuePairingCode.execute({
      organizationId: tenant.organizationId,
      restaurantId: tenant.restaurantId,
      branchId: dto.branchId,
      name: dto.name,
      createdByUserId: user.sub,
    });
    return { code, expiresAt: expiresAt.toISOString() };
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
  async revokeNode(@CurrentTenant() tenant: TenantContext, @Param('id') id: string): Promise<void> {
    await this.revoke.execute({ restaurantId: tenant.restaurantId, nodeId: id });
  }
}
