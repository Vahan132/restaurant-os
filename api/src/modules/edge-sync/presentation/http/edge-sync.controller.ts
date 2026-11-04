import { Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { ConfigSyncResult, ConfigSyncService } from '../../application/config-sync.service';
import { EdgeBootstrapService, SyncResult } from '../../application/edge-bootstrap.service';
import { PushRunResult, SyncPushService } from '../../application/sync-push.service';

/**
 * Edge sync triggers — manual re-pull of the branch snapshot and config window
 * on the hub (EDGE only). Restaurant-level admin actions gated by EDGE_MANAGE.
 * Both are idempotent.
 */
@ApiTags('edge')
@Controller('edge')
@RequirePermissions(PERMISSIONS.EDGE_MANAGE)
export class EdgeSyncController {
  constructor(
    private readonly bootstrap: EdgeBootstrapService,
    private readonly configSync: ConfigSyncService,
    private readonly pushService: SyncPushService,
  ) {}

  @Post('resync')
  @HttpCode(200)
  @ApiOperation({ summary: 'Re-pull and re-apply the full branch snapshot (idempotent).' })
  async resync(): Promise<SyncResult> {
    return this.bootstrap.sync();
  }

  @Post('sync-config')
  @HttpCode(200)
  @ApiOperation({ summary: 'Pull + apply the incremental config window now (idempotent).' })
  async syncConfig(): Promise<ConfigSyncResult> {
    return this.configSync.syncConfig();
  }

  @Post('push-now')
  @HttpCode(200)
  @ApiOperation({ summary: 'Drain the operational outbox to the cloud now (OFF-4).' })
  async pushNow(): Promise<PushRunResult> {
    return this.pushService.pushNow();
  }
}
