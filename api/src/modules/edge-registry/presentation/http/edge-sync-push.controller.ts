import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/public.decorator';
import { PushEntry } from '../../../../shared/edge/contracts/operational.contract';
import { ApplyOperationalPushUseCase } from '../../application/commands/apply-operational-push.usecase';
import { RecordHeartbeatUseCase } from '../../application/commands/record-heartbeat.usecase';
import { HeartbeatRequestDto, HeartbeatResultDto } from '../../application/dto/heartbeat.dto';
import { PushRequestDto, PushResultDto } from '../../application/dto/push.dto';
import { CurrentEdgeNode, EdgeNodeContext } from './edge-node-context';
import { EdgeAuthGuard } from './edge-auth.guard';
import { SchemaVersionGuard } from './schema-version.guard';

/**
 * Operational push + heartbeat (OFF-4/OFF-8) — authenticated by a bearer NODE
 * token (NOT a user JWT); @Public() bypasses the global JWT/Tenant guards and
 * EdgeAuthGuard resolves the node. Tenant/branch come from the node.
 *
 * `push` is additionally SchemaVersionGuard-protected (a stale hub must not write
 * a possibly-incompatible payload). `heartbeat` is DELIBERATELY NOT schema-guarded
 * so a mismatched hub can still report in and learn it must update.
 */
@ApiTags('edge-sync')
@Public()
@ApiSecurity('edge-node-token')
@UseGuards(EdgeAuthGuard)
@Controller('edge-sync')
export class EdgeSyncPushController {
  constructor(
    private readonly apply: ApplyOperationalPushUseCase,
    private readonly heartbeatUseCase: RecordHeartbeatUseCase,
  ) {}

  @Post('push')
  @HttpCode(200)
  @UseGuards(SchemaVersionGuard)
  @ApiOperation({ summary: 'Replay a batch of operational outbox entries (node-token auth).' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or revoked node token.' })
  async push(
    @CurrentEdgeNode() node: EdgeNodeContext,
    @Body() dto: PushRequestDto,
  ): Promise<PushResultDto> {
    return this.apply.execute({
      branchId: node.branchId,
      entries: dto.entries as unknown as PushEntry[],
    });
  }

  @Post('heartbeat')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Hub heartbeat: report telemetry + learn schema compatibility (node-token auth).',
  })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or revoked node token.' })
  async heartbeat(
    @CurrentEdgeNode() node: EdgeNodeContext,
    @Body() dto: HeartbeatRequestDto,
  ): Promise<HeartbeatResultDto> {
    return this.heartbeatUseCase.execute({
      restaurantId: node.restaurantId,
      nodeId: node.nodeId,
      schemaVersion: dto.schemaVersion,
      appVersion: dto.appVersion,
      pendingOutboxCount: dto.pendingOutboxCount,
    });
  }
}
