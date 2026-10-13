import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../../../shared/auth/public.decorator';
import { AppConfig } from '../../../../shared/infrastructure/config/env.schema';
import { EdgeConfigService } from '../../../../shared/edge/edge-config.service';
import { PairHubUseCase } from '../../application/pair-hub.usecase';
import {
  PairSetupDto,
  SetupPairResponse,
  SetupStatusResponse,
} from '../../application/dto/setup.dto';

/**
 * EDGE-SETUP-3A: hub-LOCAL setup surface (LAN, no cloud dependency to SERVE). Only
 * exists on an EDGE hub (this module is EDGE-only) and is @Public — an UNPAIRED hub
 * has no users yet. Drives the setup page (3B). Secrets (token/KEK) are never
 * returned here.
 */
@ApiTags('edge-setup')
@Public()
@Controller('setup')
export class SetupController {
  constructor(
    private readonly edge: EdgeConfigService,
    private readonly pairHub: PairHubUseCase,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Whether this hub is paired yet (drives setup vs operational UI).' })
  @ApiOkResponse({ type: SetupStatusResponse })
  status(): SetupStatusResponse {
    const identity = this.edge.getIdentityOrNull();
    const cloudUrl = this.config.get('CLOUD_URL', { infer: true }) ?? null;
    return {
      paired: this.edge.isPaired,
      setupMode: this.edge.isSetupMode,
      nodeId: identity?.nodeId ?? null,
      branchId: identity?.branchId ?? null,
      cloudUrl,
      cloudConfigured: Boolean(cloudUrl),
    };
  }

  @Post('pair')
  @ApiOperation({
    summary: 'Redeem a pairing code: enrol this hub, persist its identity, and restart.',
  })
  @ApiOkResponse({ type: SetupPairResponse })
  async pair(@Body() dto: PairSetupDto): Promise<SetupPairResponse> {
    return this.pairHub.execute({
      pairingCode: dto.pairingCode,
      cloudUrl: dto.cloudUrl,
      network: dto.network,
    });
  }
}
