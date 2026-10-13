import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

/** No restaurant scope on the principal — imports are restaurant-scoped. */
export const NoRestaurantInScope = () =>
  new BadRequestException({
    code: 'NO_RESTAURANT_IN_SCOPE',
    message: 'Your account is not scoped to a restaurant.',
  });

/** No file was supplied on the multipart upload. */
export const NoFileUploaded = () =>
  new BadRequestException({
    code: 'NO_FILE_UPLOADED',
    message: 'A CSV file is required (multipart field "file").',
  });

/** The file could not be parsed at all (not CSV / empty / unreadable). */
export const InvalidCsvFile = (message: string) =>
  new BadRequestException({ code: 'INVALID_CSV_FILE', message });

/** Required canonical columns were missing after tolerant mapping. */
export const MissingRequiredColumns = (missing: string[]) =>
  new BadRequestException({
    code: 'MISSING_REQUIRED_COLUMNS',
    message: `CSV is missing required column(s): ${missing.join(', ')}.`,
    details: { missing },
  });

/** Batch lookup miss (or out of the caller's branch scope). */
export const ImportBatchNotFound = () =>
  new NotFoundException({
    code: 'IMPORT_BATCH_NOT_FOUND',
    message: 'Import batch not found.',
  });

/** Date range filter where from > to. */
export const BranchAccessForbidden = () =>
  new ForbiddenException({
    code: 'BRANCH_ACCESS_FORBIDDEN',
    message: 'You do not have access to the requested branch.',
  });

export const InvalidDateRange = () =>
  new BadRequestException({
    code: 'INVALID_DATE_RANGE',
    message: '`from` must be on or before `to`.',
  });
