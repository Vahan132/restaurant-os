import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** POST /edge-nodes/provision body (restaurant-admin, EDGE_MANAGE). */
export class ProvisionHubDto {
  @ApiProperty({ description: 'The branch this hub will serve.' })
  @IsString()
  @MinLength(1)
  branchId!: string;

  @ApiProperty({ description: 'Human-friendly hub name, e.g. "Kitchen hub".' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    description:
      'Cloud API base the hub syncs from, e.g. https://your-server/res/api. The ' +
      'admin sends its own origin; leave blank only if the hub will be pointed later.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  cloudUrl?: string;
}

export class ProvisionHubFile {
  @ApiProperty({ description: 'File path inside the downloaded zip.' })
  path!: string;
  @ApiProperty({ description: 'Full file contents.' })
  content!: string;
}

/** POST /edge-nodes/provision response — the ready-to-run bundle. Secrets ONCE. */
export class ProvisionHubResponse {
  @ApiProperty() nodeId!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ description: 'Suggested download file name for the zip.' })
  bundleName!: string;
  @ApiProperty({
    type: [ProvisionHubFile],
    description: 'Files to place in the zip. Contain secrets — shown ONCE, not re-fetchable.',
  })
  files!: ProvisionHubFile[];
}
