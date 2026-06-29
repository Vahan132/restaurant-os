import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ModifierGroup } from '../../domain/entities/modifier-group';
import { MenuStatus, ModifierSelectionType } from '../../domain/enums';
import {
  MODIFIER_GROUP_REPOSITORY,
  ModifierGroupRepository,
} from '../../domain/repositories/modifier-group.repository';
import {
  MODIFIER_OPTION_REPOSITORY,
  ModifierOptionRepository,
} from '../../domain/repositories/modifier-option.repository';
import { ModifierGroupNotFound, NoRestaurantInScope } from '../application.errors';

export interface UpdateModifierGroupInput {
  restaurantId: string | null;
  branchId: string;
  groupId: string;
  name?: string;
  selectionType?: ModifierSelectionType;
  required?: boolean;
  minSelect?: number | null;
  maxSelect?: number | null;
  status?: MenuStatus;
}

/** Update a modifier group; validates maxSelect against the current option count. */
@Injectable()
export class UpdateModifierGroupUseCase implements UseCase<
  UpdateModifierGroupInput,
  ModifierGroup
> {
  constructor(
    @Inject(MODIFIER_GROUP_REPOSITORY) private readonly groups: ModifierGroupRepository,
    @Inject(MODIFIER_OPTION_REPOSITORY) private readonly options: ModifierOptionRepository,
  ) {}

  async execute(input: UpdateModifierGroupInput): Promise<ModifierGroup> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const group = await this.groups.findById(input.restaurantId, input.branchId, input.groupId);
    if (!group) {
      throw ModifierGroupNotFound();
    }
    group.update({
      name: input.name,
      selectionType: input.selectionType,
      required: input.required,
      minSelect: input.minSelect,
      maxSelect: input.maxSelect,
      status: input.status,
    });
    const optionCount = await this.options.countByGroup(
      input.restaurantId,
      input.branchId,
      group.id,
    );
    group.assertConsistentWithOptionCount(optionCount); // throws if maxSelect > options
    await this.groups.update(group);
    return group;
  }
}
