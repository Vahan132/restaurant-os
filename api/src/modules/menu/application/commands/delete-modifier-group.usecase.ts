import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  DISH_MODIFIER_GROUP_REPOSITORY,
  DishModifierGroupRepository,
} from '../../domain/repositories/dish-modifier-group.repository';
import {
  MODIFIER_GROUP_REPOSITORY,
  ModifierGroupRepository,
} from '../../domain/repositories/modifier-group.repository';
import {
  ModifierGroupInUse,
  ModifierGroupNotFound,
  NoRestaurantInScope,
} from '../application.errors';

export interface DeleteModifierGroupInput {
  restaurantId: string | null;
  branchId: string;
  groupId: string;
}

/**
 * Soft-delete a library modifier group (restaurant+branch-scoped). Guard: blocked
 * while the group is attached to any dish — detach it everywhere first (or archive
 * via status=INACTIVE to hide it without deleting).
 */
@Injectable()
export class DeleteModifierGroupUseCase implements UseCase<DeleteModifierGroupInput, void> {
  constructor(
    @Inject(MODIFIER_GROUP_REPOSITORY) private readonly groups: ModifierGroupRepository,
    @Inject(DISH_MODIFIER_GROUP_REPOSITORY)
    private readonly attachments: DishModifierGroupRepository,
  ) {}

  async execute(input: DeleteModifierGroupInput): Promise<void> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const group = await this.groups.findById(input.restaurantId, input.branchId, input.groupId);
    if (!group) {
      throw ModifierGroupNotFound();
    }
    const attachedCount = await this.attachments.countByGroup(
      input.restaurantId,
      input.branchId,
      group.id,
    );
    if (attachedCount > 0) {
      throw ModifierGroupInUse();
    }
    group.softDelete();
    await this.groups.update(group);
  }
}
