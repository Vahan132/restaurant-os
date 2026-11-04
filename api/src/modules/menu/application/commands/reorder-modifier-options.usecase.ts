import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ModifierOption } from '../../domain/entities/modifier-option';
import {
  MODIFIER_GROUP_REPOSITORY,
  ModifierGroupRepository,
} from '../../domain/repositories/modifier-group.repository';
import {
  MODIFIER_OPTION_REPOSITORY,
  ModifierOptionRepository,
} from '../../domain/repositories/modifier-option.repository';
import {
  ModifierGroupNotFound,
  ModifierOptionNotFound,
  NoRestaurantInScope,
} from '../application.errors';

export interface ReorderModifierOptionsInput {
  restaurantId: string | null;
  branchId: string;
  groupId: string;
  /** Option ids in the desired order (must be exactly the group's live options). */
  orderedOptionIds: string[];
}

/** Reorder a group's options; sortOrder is assigned from the array position. */
@Injectable()
export class ReorderModifierOptionsUseCase implements UseCase<
  ReorderModifierOptionsInput,
  ModifierOption[]
> {
  constructor(
    @Inject(MODIFIER_GROUP_REPOSITORY) private readonly groups: ModifierGroupRepository,
    @Inject(MODIFIER_OPTION_REPOSITORY) private readonly options: ModifierOptionRepository,
  ) {}

  async execute(input: ReorderModifierOptionsInput): Promise<ModifierOption[]> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const group = await this.groups.findById(input.restaurantId, input.branchId, input.groupId);
    if (!group) {
      throw ModifierGroupNotFound();
    }
    const current = await this.options.listByGroup(input.restaurantId, input.branchId, group.id);
    const byId = new Map(current.map((o) => [o.id, o]));
    for (const id of input.orderedOptionIds) {
      if (!byId.has(id)) {
        throw ModifierOptionNotFound();
      }
    }
    const reordered: ModifierOption[] = [];
    let index = 0;
    for (const id of input.orderedOptionIds) {
      const option = byId.get(id)!;
      option.update({ sortOrder: index });
      await this.options.update(option);
      reordered.push(option);
      index += 1;
    }
    return reordered;
  }
}
