import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * POST /edge-sync/heartbeat body — a hub's periodic self-report (OFF-8). Sent
 * every 30–60s while online. Authenticated by the node token (EdgeAuthGuard);
 * this endpoint is intentionally NOT schema-guarded so a hub on a mismatched
 * schema can still report in (and learn it must update).
 */
export class HeartbeatRequestDto {
  @ApiProperty({ nullable: true, type: String, description: 'When config last synced from cloud (ISO).' })
  @IsOptional()
  @IsISO8601()
  lastConfigSyncedAt?: string | null;

  @ApiProperty({ nullable: true, type: Number, description: 'Highest outbox edgeSeq acked by the cloud.' })
  @IsOptional()
  @IsInt()
  lastPushedSeq?: number | null;

  @ApiProperty({ description: 'Pending edge→cloud outbox entries on the hub.' })
  @IsInt()
  @Min(0)
  pendingOutboxCount!: number;

  @ApiProperty({ description: 'The hub application version.' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  appVersion!: string;

  @ApiProperty({ description: 'The hub edge schema version.' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  schemaVersion!: string;

  @ApiProperty({ description: 'Local DB status as the hub sees it.', example: 'ok' })
  @IsString()
  @MaxLength(16)
  dbStatus!: string;

  @ApiProperty({ description: 'Process uptime in seconds.' })
  @IsInt()
  @Min(0)
  uptimeSeconds!: number;
}

/** POST /edge-sync/heartbeat response — tells the hub whether it may sync. */
export class HeartbeatResultDto {
  @ApiProperty({
    enum: ['OK', 'SYNC_BACKLOG', 'SCHEMA_MISMATCH'],
    description: 'Stored health derived from this heartbeat (never OFFLINE here).',
  })
  healthStatus!: string;

  @ApiProperty({ description: 'True when the hub schema version matches the cloud.' })
  schemaMatch!: boolean;

  @ApiProperty({ description: 'True when the operator must update the hub before sync resumes.' })
  updateRequired!: boolean;

  @ApiProperty({ description: 'The schema version the cloud expects.' })
  expectedSchemaVersion!: string;

  @ApiProperty({ description: 'The app version the cloud currently expects.' })
  expectedAppVersion!: string;

  @ApiProperty({ description: 'Cloud server time (ISO).' })
  serverTime!: string;
}
