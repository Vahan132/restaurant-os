import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

/** Platform-catalog application error helpers (standard { code, message } shape). */

export const CatalogItemNotFound = () =>
  new NotFoundException({ code: 'CATALOG_ITEM_NOT_FOUND', message: 'Catalog item not found.' });

export const CatalogSlugAlreadyExists = () =>
  new ConflictException({
    code: 'CATALOG_SLUG_ALREADY_EXISTS',
    message: 'A catalog item with this slug already exists.',
  });

export const UnknownAllergenTags = (slugs: string[]) =>
  new BadRequestException({
    code: 'UNKNOWN_ALLERGEN_TAGS',
    message: `Unknown allergen tags: ${slugs.join(', ')}.`,
    details: { slugs },
  });

export const UnknownCatalogCategory = () =>
  new BadRequestException({
    code: 'UNKNOWN_CATALOG_CATEGORY',
    message: 'The referenced catalog category does not exist.',
  });

/** Top-level bulk-import failure: unparseable CSV or missing required headers. */
export const CatalogImportInvalidCsv = (detail: string) =>
  new BadRequestException({
    code: 'CATALOG_IMPORT_INVALID_CSV',
    message: `Invalid import CSV: ${detail}`,
  });
