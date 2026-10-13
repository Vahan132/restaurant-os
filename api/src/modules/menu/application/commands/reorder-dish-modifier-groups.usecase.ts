import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DishModifierGroup } from '../../domain/entities/dish-modifier-group';
import {
  DISH_MODIFIER_GROUP_REPOSITORY,
  DishModifierGroupRepository,
} from '../../domain/repositories/dish-modifier-group.repository';
import { DishModifierGroupNotFound, NoRestaurantInScope } from '../application.errors';

export interface ReorderDishModifierGroupsInput {
  restaurantId: string | null;
  branchId: string;
  itemId: string;
  /** Group ids in the desired order (must be exactly the dish's attached groups). */
  orderedGroupIds: string[];
}

/** Reorder a dish's attached modifier groups; sortOrder from array position. */
@Injectable()
export class ReorderDishModifierGroupsUseCase implements UseCase<
  ReorderDishModifierGroupsInput,
  DishModifierGroup[]
> {
  constructor(
    @Inject(DISH_MODIFIER_GROUP_REPOSITORY)
    private readonly attachments: DishModifierGroupRepository,
  ) {}

  async execute(input: ReorderDishModifierGroupsInput): Promise<DishModifierGroup[]> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const current = await this.attachments.listByItem(
      input.restaurantId,
      input.branchId,
      input.itemId,
    );
    const byGroupId = new Map(current.map((a) => [a.modifierGroupId, a]));
    for (const groupId of input.orderedGroupIds) {
      if (!byGroupId.has(groupId)) {
        throw DishModifierGroupNotFound();
      }
    }
    const reordered: DishModifierGroup[] = [];
    let index = 0;
    for (const groupId of input.orderedGroupIds) {
      const attachment = byGroupId.get(groupId)!;
      attachment.setSortOrder(index);
      await this.attachments.update(attachment);
      reordered.push(attachment);
      index += 1;
    }
    return reordered;
  }
}
