import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DEFAULT_LIMIT, DEFAULT_PAGE, PaginationMeta } from '../../application/pagination';

interface PaginatedShape {
  data: unknown[];
  pagination: PaginationMeta;
}

function isPaginated(value: unknown): value is PaginatedShape {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as Record<string, unknown>).data) &&
    typeof (value as Record<string, unknown>).pagination === 'object' &&
    (value as Record<string, unknown>).pagination !== null
  );
}

/**
 * ResponseEnvelopeInterceptor — standardizes successful responses.
 *
 * - A Paginated<T> result (`{ data, pagination }`) passes through unchanged.
 * - A bare array is wrapped into `{ data, pagination }` with simple metadata.
 * - Any other (single resource) value is returned as-is.
 *
 * Controllers should return plain data; for real lists prefer the `paginate()`
 * helper so `total`/`totalPages` are accurate.
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((value: unknown) => {
        if (isPaginated(value)) {
          return value;
        }

        if (Array.isArray(value)) {
          const total = value.length;
          const limit = total === 0 ? DEFAULT_LIMIT : total;
          return {
            data: value,
            pagination: {
              page: DEFAULT_PAGE,
              limit,
              total,
              totalPages: total === 0 ? 0 : 1,
            },
          } satisfies PaginatedShape;
        }

        return value;
      }),
    );
  }
}
