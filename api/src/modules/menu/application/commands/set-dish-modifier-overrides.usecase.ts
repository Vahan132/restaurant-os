import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DishModifierGroup } from '../../domain/entities/dish-modifier-group';
import {
  DISH_MODIFIER_GROUP_REPOSITORY,
  DishModifierGroupRepository,
} from '../../domain/repositories/dish-modifier-group.repository';
import { DishModifierGroupNotFound, NoRestaurantInScope } from '../application.errors';

export interface SetDishModifierOverridesInput {
  restaurantId: string | null;
  branchId: string;
  itemId: string;
  groupId: string;
  // `undefined` leaves a field unchanged; explicit `null` CLEARS the override
  // (reverting to the group's own value).
  requiredOverride?: boolean | null;
  minOverride?: number | null;
  maxOverride?: number | null;
  sortOrder?: number;
}

/** Set or clear per-attachment overrides for a dish's modifier group. */
@Injectable()
export class SetDishModifierOverridesUseCase implements UseCase<
  SetDishModifierOverridesInput,
  DishModifierGroup
> {
  constructor(
    @Inject(DISH_MODIFIER_GROUP_REPOSITORY)
    private readonly attachments: DishModifierGroupRepository,
  ) {}

  async execute(input: SetDishModifierOverridesInput): Promise<DishModifierGroup> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const attachment = await this.attachments.findByItemAndGroup(
      input.restaurantId,
      input.branchId,
      input.itemId,
      input.groupId,
    );
    if (!attachment) {
      throw DishModifierGroupNotFound();
    }
    attachment.setOverrides({
      requiredOverride: input.requiredOverride,
      minOverride: input.minOverride,
      maxOverride: input.maxOverride,
      sortOrder: input.sortOrder,
    });
    await this.attachments.update(attachment);
    return attachment;
  }
}
