import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = ['text', 'int', 'qty', 'money', 'percent', 'date'] as const;
const ROW_STYLES = ['group', 'subtotal', 'total'] as const;
const LANGS = ['hy', 'ru', 'en'] as const;

export class ExportColumnDto {
  @ApiProperty() @IsString() @MaxLength(200) header!: string;

  @ApiProperty({ enum: KINDS })
  @IsIn(KINDS as unknown as string[])
  kind!: (typeof KINDS)[number];

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(4) @Max(120) width?: number;
}

export class ExportRowDto {
  @ApiProperty({
    description: 'Cell values in column order (string, number or null). Money in MAJOR units.',
    type: 'array',
    items: { oneOf: [{ type: 'string' }, { type: 'number' }] },
  })
  @IsArray()
  @ArrayMaxSize(100)
  cells!: Array<string | number | null>;

  @ApiPropertyOptional({ enum: ROW_STYLES })
  @IsOptional()
  @IsIn(ROW_STYLES as unknown as string[])
  style?: (typeof ROW_STYLES)[number];
}

export class ExportSheetDto {
  @ApiProperty() @IsString() @MaxLength(100) name!: string;
  @ApiProperty() @IsString() @MaxLength(300) title!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  infoLines?: string[];

  @ApiProperty({ type: [ExportColumnDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ExportColumnDto)
  columns!: ExportColumnDto[];

  @ApiProperty({ type: [ExportRowDto] })
  @IsArray()
  @ArrayMaxSize(50000)
  @ValidateNested({ each: true })
  @Type(() => ExportRowDto)
  rows!: ExportRowDto[];
}

/** REPORT-XLSX-1: render any on-screen report table into the standard workbook. */
export class ExportTableDto {
  @ApiPropertyOptional({ description: 'Download file name (without extension).' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fileName?: string;

  @ApiPropertyOptional({ description: 'Money fraction digits (AMD/USD/RUB = 2 per Intl).' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4)
  moneyDecimals?: number;

  @ApiPropertyOptional({
    description:
      'When set (e.g. "Склад(ы)"), a "<label>: <active warehouse names>" line is added under ' +
      'each sheet title.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  warehousesLabel?: string;

  @ApiPropertyOptional({
    description: 'Branch the on-screen table was filtered to (warehouses line + branch line).',
  })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Label for the branch line, e.g. "Branch" (added when branchId is set).',
  })
  @IsOptional()
  @IsString()
  branchLabel?: string;

  @ApiProperty({ type: [ExportSheetDto] })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ExportSheetDto)
  sheets!: ExportSheetDto[];
}

/** Full cost-price / profit / write-off / expense workbook for a period. */
export class ProfitExportQuery {
  @ApiProperty({ description: 'From date (YYYY-MM-DD, inclusive, restaurant tz).' })
  @Matches(DATE, { message: 'from must be YYYY-MM-DD' })
  from!: string;

  @ApiProperty({ description: 'To date (YYYY-MM-DD, inclusive, restaurant tz).' })
  @Matches(DATE, { message: 'to must be YYYY-MM-DD' })
  to!: string;

  @ApiPropertyOptional({ enum: LANGS, default: 'ru' })
  @IsOptional()
  @IsIn(LANGS as unknown as string[])
  lang?: (typeof LANGS)[number];

  @ApiPropertyOptional({
    description:
      'Only this branch. Omitted = every branch the caller may report on (all branches for the owner).',
  })
  @IsOptional()
  @IsString()
  branchId?: string;
}

export function safeFileName(raw: string | undefined, fallback: string): string {
  const cleaned = (raw ?? '')
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  return cleaned || fallback;
}
