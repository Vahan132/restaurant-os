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
