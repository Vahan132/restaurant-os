import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class DateRangeQuery {
  @ApiProperty({ description: 'From date (YYYY-MM-DD, inclusive, restaurant tz).' })
  @Matches(DATE, { message: 'from must be YYYY-MM-DD' })
  from!: string;

  @ApiProperty({ description: 'To date (YYYY-MM-DD, inclusive, restaurant tz).' })
  @Matches(DATE, { message: 'to must be YYYY-MM-DD' })
  to!: string;
}

export class BusinessDayQuery {
  @ApiPropertyOptional({
    description: 'Business day (YYYY-MM-DD, restaurant tz). Defaults to today there.',
  })
  @IsOptional()
  @Matches(DATE, { message: 'date must be YYYY-MM-DD' })
  date?: string;
}

export class TimeSeriesQuery extends DateRangeQuery {
  @ApiPropertyOptional({ enum: ['day', 'week', 'month'], default: 'day' })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy: 'day' | 'week' | 'month' = 'day';
}
