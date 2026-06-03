import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

/**
 * `includeUnavailable` is parsed as a string ("true"/"false") to avoid the
 * implicit boolean-coercion gotcha (Boolean("false") === true). Defaults to
 * true; only the literal "false" disables unavailable items.
 */
export class MenuTreeQuery {
  @ApiPropertyOptional({
    description: 'Include UNAVAILABLE items (shown but flagged). Default true.',
    enum: ['true', 'false'],
    default: 'true',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  includeUnavailable?: string;
}
