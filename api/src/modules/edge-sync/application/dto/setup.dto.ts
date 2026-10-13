import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** POST /setup/pair body — the admin enters just the pairing code (network optional). */
export class PairSetupDto {
  @ApiProperty({ description: 'The pairing code from the admin console.' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  pairingCode!: string;

  @ApiPropertyOptional({
    description:
      'Cloud server address the hub should pair against and remember, e.g. ' +
      'https://your-server/res/api. Optional when the hub image already has one baked in.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  cloudUrl?: string;

  @ApiPropertyOptional({
    description:
      'Optional network hint (advisory only — real network config is OS-level; the ' +
      'hub defaults to DHCP). Ignored by the backend in EDGE-SETUP-3A.',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  network?: Record<string, unknown>;
}

/** GET /setup/status response. */
export class SetupStatusResponse {
  @ApiProperty({ description: 'True once the hub has a persisted identity (paired).' })
  paired!: boolean;
  @ApiProperty({ description: 'True while the hub is unpaired and serving setup only.' })
  setupMode!: boolean;
  @ApiProperty({ nullable: true, type: String, description: 'The paired node id (null if unpaired).' })
  nodeId!: string | null;
  @ApiProperty({ nullable: true, type: String, description: 'The served branch id (null if unpaired).' })
  branchId!: string | null;
  @ApiProperty({ nullable: true, type: String, description: 'The cloud server address configured on this hub (null if unset).' })
  cloudUrl!: string | null;
  @ApiProperty({ description: 'True when a cloud server address is already configured (baked-in or persisted).' })
  cloudConfigured!: boolean;
}

/** POST /setup/pair response — never includes the token or KEK. */
export class SetupPairResponse {
  @ApiProperty() paired!: boolean;
  @ApiProperty() nodeId!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty({ description: 'True — the hub is restarting to load the new identity.' })
  restarting!: boolean;
}
