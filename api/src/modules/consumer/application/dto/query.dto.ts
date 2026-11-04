import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';

/** Normalize a repeated query param to a string[] (single value → one-element array). */
function toStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const arr = Array.isArray(value) ? value : [value];
  return arr.map((v) => String(v)).filter((v) => v.length > 0);
}

export class ListConsumerBranchesQuery {
  @ApiPropertyOptional({ description: 'Free-text search over brand name + address/city.' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Repeated attributeValueId filter. A branch matches when its restaurant has ALL ' +
      'selected values (AND across categories).',
  })
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  attributeValueIds?: string[];

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ConsumerAvailabilityQuery {
  @ApiPropertyOptional({ description: 'ISO-8601 window start (defaults to now).' })
  @IsOptional()
  @IsISO8601()
  windowStart?: string;

  @ApiPropertyOptional({ description: 'ISO-8601 window end (defaults to start + 24h).' })
  @IsOptional()
  @IsISO8601()
  windowEnd?: string;
}
