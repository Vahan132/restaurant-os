import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** POST /edge-nodes/pairing-code body (restaurant-admin, EDGE_MANAGE). */
export class IssuePairingCodeDto {
  @ApiProperty({ description: 'The branch the paired hub will serve.' })
  @IsString()
  @MinLength(1)
  branchId!: string;

  @ApiProperty({ description: 'Human-friendly node name, e.g. "Kitchen hub".' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}

/** POST /edge-nodes/pairing-code response — the code is shown ONCE. */
export class PairingCodeResponse {
  @ApiProperty({
    description: 'The pairing code to read out to the restaurant. Shown ONCE; store it now.',
    example: 'K7M2-QP9X',
  })
  code!: string;
  @ApiProperty({ description: 'When the code expires (ISO-8601).' })
  expiresAt!: string;
}

/** POST /edge/pair body — the hub submits the code it was given. */
export class PairEdgeNodeDto {
  @ApiProperty({ description: 'The pairing code (case-insensitive; spaces/hyphens ignored).' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code!: string;
}

/**
 * POST /edge/pair response — the node credential + the per-hub fiscal KEK,
 * delivered EXACTLY ONCE over TLS. Neither is re-fetchable; a hub that loses them
 * must re-pair (which rotates both).
 */
export class EdgePairResponse {
  @ApiProperty() nodeId!: string;
  @ApiProperty({ description: 'Long-lived node bearer token. Write to EDGE_NODE_TOKEN. Shown ONCE.' })
  nodeToken!: string;
  @ApiProperty({
    description:
      'Per-hub fiscal KEK as 64 hex chars (32 bytes). Write VERBATIM to the ' +
      'FISCAL_MASTER_KEK slot (validated as 64-hex). Shown ONCE.',
  })
  fiscalKek!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty() branchId!: string;
}
