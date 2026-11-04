import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsTimeZone } from 'class-validator';

/**
 * A restaurant time zone: an IANA id Intl accepts (e.g. "Asia/Yerevan",
 * "Etc/GMT-4"). Whitespace is stripped first so the legacy signup value
 * "Etc/GMT- 4" is repaired instead of stored — an invalid zone crashes every
 * Intl-based date view (admin audit/reports) and server-side report bucketing.
 */
export function IsRestaurantTimeZone(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s+/g, '') : value)),
    IsTimeZone(),
  );
}
