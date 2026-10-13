import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsIn, IsObject, IsOptional } from 'class-validator';
import { ALL_CATALOG_SECTIONS, CatalogBundle, CatalogSection } from '../catalog-bundle';
import type { CatalogReport, SectionReport } from '../catalog-report';

export enum ImportMode {
  DRY_RUN = 'DRY_RUN',
  APPLY = 'APPLY',
}

export enum ConflictStrategy {
  SKIP = 'SKIP',
  OVERWRITE = 'OVERWRITE',
}

const SECTION_VALUES = [...ALL_CATALOG_SECTIONS];

/** Parse a comma-separated `?include=` query into a validated section array. */
function parseInclude(value: unknown): CatalogSection[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = Array.isArray(value) ? value : String(value).split(',');
  return raw.map((s) => String(s).trim()).filter((s) => s.length > 0) as CatalogSection[];
}

export class ExportQueryDto {
  @ApiPropertyOptional({
    description: 'Comma-separated sections to include. Omit for all.',
    enum: SECTION_VALUES,
    isArray: true,
    example: 'menu,inventory,recipes,processes',
  })
  @IsOptional()
  @Transform(({ value }) => parseInclude(value))
  @IsArray()
  @IsIn(SECTION_VALUES, { each: true })
  include?: CatalogSection[];

  @ApiPropertyOptional({ description: 'Response format.', enum: ['json', 'xlsx'], default: 'json' })
  @IsOptional()
  @IsIn(['json', 'xlsx'])
  format?: 'json' | 'xlsx';
}

export class ImportBodyDto {
  @ApiProperty({ description: 'The catalog bundle (JSON) to import.', type: Object })
  @IsObject()
  bundle!: CatalogBundle;

  @ApiProperty({ enum: ImportMode, description: 'DRY_RUN reports only; APPLY persists.' })
  @IsEnum(ImportMode)
  mode!: ImportMode;

  @ApiPropertyOptional({
    enum: ConflictStrategy,
    default: ConflictStrategy.OVERWRITE,
    description: 'On key collision: SKIP (leave) or OVERWRITE (reconcile to match).',
  })
  @IsOptional()
  @IsEnum(ConflictStrategy)
  conflictStrategy?: ConflictStrategy;
}

export class CloneBodyDto {
  @ApiPropertyOptional({
    description: 'Comma-separated / array of sections to clone. Omit for all.',
    enum: SECTION_VALUES,
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => parseInclude(value))
  @IsArray()
  @IsIn(SECTION_VALUES, { each: true })
  include?: CatalogSection[];

  @ApiProperty({ enum: ImportMode })
  @IsEnum(ImportMode)
  mode!: ImportMode;

  @ApiPropertyOptional({ enum: ConflictStrategy, default: ConflictStrategy.OVERWRITE })
  @IsOptional()
  @IsEnum(ConflictStrategy)
  conflictStrategy?: ConflictStrategy;
}

// ── Response DTOs ────────────────────────────────────────────────────────────

export class SectionReportResponse {
  @ApiProperty() created!: number;
  @ApiProperty() updated!: number;
  @ApiProperty() skipped!: number;
  @ApiProperty({
    type: 'array',
    items: { type: 'object', properties: { key: { type: 'string' }, message: { type: 'string' } } },
  })
  errors!: Array<{ key: string; message: string }>;

  static from(r: SectionReport): SectionReportResponse {
    return { created: r.created, updated: r.updated, skipped: r.skipped, errors: r.errors };
  }
}

export class CatalogReportResponse {
  @ApiProperty() ok!: boolean;
  @ApiProperty({ enum: ImportMode }) mode!: 'DRY_RUN' | 'APPLY';
  @ApiProperty({ enum: ConflictStrategy }) conflictStrategy!: 'SKIP' | 'OVERWRITE';
  @ApiProperty({ type: Object, description: 'Per-section counters + errors.' })
  sections!: Record<string, SectionReportResponse>;

  static from(report: CatalogReport): CatalogReportResponse {
    const sections: Record<string, SectionReportResponse> = {};
    for (const [name, sr] of Object.entries(report.sections)) {
      sections[name] = SectionReportResponse.from(sr);
    }
    return {
      ok: report.ok,
      mode: report.mode,
      conflictStrategy: report.conflictStrategy,
      sections,
    };
  }
}
