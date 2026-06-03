import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { MenuItem } from '../../domain/entities/menu-item';
import { PreparationStation } from '../../domain/enums';
import {
  MENU_CATEGORY_REPOSITORY,
  MenuCategoryRepository,
} from '../../domain/repositories/menu-category.repository';
import {
  MENU_ITEM_REPOSITORY,
  MenuItemRepository,
} from '../../domain/repositories/menu-item.repository';
import { CategoryNotFound, NoRestaurantInScope } from '../application.errors';

export interface CreateMenuItemInput {
  restaurantId: string | null;
  categoryId: string;
  name: string;
  description?: string | null;
  priceAmount: number;
  imageUrl?: string | null;
  preparationStation?: PreparationStation;
  prepTimeMinutes?: number | null;
  actorUserId?: string | null;
}

/** Create a menu item (verifies category belongs to the same restaurant). */
@Injectable()
export class CreateMenuItemUseCase implements UseCase<CreateMenuItemInput, MenuItem> {
  constructor(
    @Inject(MENU_ITEM_REPOSITORY) private readonly items: MenuItemRepository,
    @Inject(MENU_CATEGORY_REPOSITORY) private readonly categories: MenuCategoryRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: CreateMenuItemInput): Promise<MenuItem> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const category = await this.categories.findById(input.restaurantId, input.categoryId);
    if (!category) {
      throw CategoryNotFound();
    }
    const item = MenuItem.create({
      id: this.ids.generate(),
      restaurantId: input.restaurantId,
      categoryId: input.categoryId,
      name: input.name,
      description: input.description ?? null,
      priceAmount: input.priceAmount, // aggregate rejects negatives
      imageUrl: input.imageUrl ?? null,
      preparationStation: input.preparationStation,
      prepTimeMinutes: input.prepTimeMinutes ?? null,
      actorUserId: input.actorUserId ?? null,
    });
    await this.items.create(item);
    await this.events.publishFromAggregate(item);
    return item;
  }
}
