import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  DISH_MODIFIER_GROUP_REPOSITORY,
  DishModifierGroupRepository,
} from '../../domain/repositories/dish-modifier-group.repository';
import { DishModifierGroupNotFound, NoRestaurantInScope } from '../application.errors';

export interface DetachModifierGroupInput {
  restaurantId: string | null;
  branchId: string;
  itemId: string;
  groupId: string;
}

/** Detach a modifier group from a dish (hard-deletes the attachment row). */
@Injectable()
export class DetachModifierGroupFromDishUseCase implements UseCase<DetachModifierGroupInput, void> {
  constructor(
    @Inject(DISH_MODIFIER_GROUP_REPOSITORY)
    private readonly attachments: DishModifierGroupRepository,
  ) {}

  async execute(input: DetachModifierGroupInput): Promise<void> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const existing = await this.attachments.findByItemAndGroup(
      input.restaurantId,
      input.branchId,
      input.itemId,
      input.groupId,
    );
    if (!existing) {
      throw DishModifierGroupNotFound();
    }
    await this.attachments.deleteByItemAndGroup(
      input.restaurantId,
      input.branchId,
      input.itemId,
      input.groupId,
    );
  }
}
