import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export type ImportMode = 'DRY_RUN' | 'APPLY';
export type ConflictStrategy = 'SKIP' | 'OVERWRITE';
export type ImportRowAction = 'CREATE' | 'UPDATE' | 'UNCHANGED' | 'SKIP' | 'ERROR';

/** Request body for `POST platform/catalog-items/import`. */
export class ImportCatalogItemsRequestDto {
  @ApiProperty({ enum: ['DRY_RUN', 'APPLY'], description: 'DRY_RUN previews; APPLY writes.' })
  @IsIn(['DRY_RUN', 'APPLY'])
  mode!: ImportMode;

  @ApiPropertyOptional({
    enum: ['SKIP', 'OVERWRITE'],
    default: 'OVERWRITE',
    description: 'How to treat rows whose slug already exists. Defaults to OVERWRITE.',
  })
  @IsOptional()
  @IsIn(['SKIP', 'OVERWRITE'])
  conflictStrategy?: ConflictStrategy;

  @ApiProperty({ description: 'Raw CSV text (header row required).' })
  @IsString()
  @IsNotEmpty()
  csv!: string;
}

export class ImportRowMessageResponse {
  @ApiProperty({ description: 'UPPER_SNAKE per-row error code.' })
  code!: string;

  @ApiPropertyOptional({ description: 'The offending CSV column, when applicable.' })
  field?: string;

  @ApiProperty({ description: 'Human-readable explanation.' })
  detail!: string;
}

export class ImportItemRowResponse {
  @ApiProperty({ description: '1-based source line of the row.' })
  line!: number;

  @ApiProperty({ description: 'Row slug (as normalized), or the raw value when unusable.' })
  slug!: string;

  @ApiProperty({
    enum: ['CREATE', 'UPDATE', 'UNCHANGED', 'SKIP', 'ERROR'],
    description: 'Resolved action for this row.',
  })
  action!: ImportRowAction;

  @ApiProperty({ type: [ImportRowMessageResponse] })
  messages!: ImportRowMessageResponse[];
}

export class ImportSummaryResponse {
  @ApiProperty() total!: number;
  @ApiProperty() toCreate!: number;
  @ApiProperty() toUpdate!: number;
  @ApiProperty() unchanged!: number;
  @ApiProperty() skipped!: number;
  @ApiProperty() errors!: number;
}

export class ImportCatalogItemsResponse {
  @ApiProperty({ enum: ['DRY_RUN', 'APPLY'] })
  mode!: ImportMode;

  @ApiProperty({ enum: ['SKIP', 'OVERWRITE'] })
  conflictStrategy!: ConflictStrategy;

  @ApiProperty({ description: 'True only when APPLY wrote all rows in one transaction.' })
  applied!: boolean;

  @ApiProperty({ type: ImportSummaryResponse })
  summary!: ImportSummaryResponse;

  @ApiProperty({ type: [ImportItemRowResponse] })
  rows!: ImportItemRowResponse[];
}
