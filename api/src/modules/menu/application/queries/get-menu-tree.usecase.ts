import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { NoRestaurantInScope } from '../application.errors';
import { MENU_TREE_READER, MenuTreeCategory, MenuTreeReader } from '../ports/menu-tree.reader';

export interface GetMenuTreeInput {
  restaurantId: string | null;
  includeUnavailable?: boolean;
}

/**
 * The single read model POS/KDS/QR consume: ACTIVE categories -> ACTIVE items
 * (with availability flag + modifier groups/options). INACTIVE and soft-deleted
 * never appear. includeUnavailable defaults to true.
 */
@Injectable()
export class GetMenuTreeUseCase implements UseCase<GetMenuTreeInput, MenuTreeCategory[]> {
  constructor(@Inject(MENU_TREE_READER) private readonly reader: MenuTreeReader) {}

  execute(input: GetMenuTreeInput): Promise<MenuTreeCategory[]> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    return this.reader.getTree(input.restaurantId, input.includeUnavailable ?? true);
  }
}
