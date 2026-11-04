import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ModifierGroup } from '../../domain/entities/modifier-group';
import { ModifierOption } from '../../domain/entities/modifier-option';
import {
  MODIFIER_GROUP_REPOSITORY,
  ModifierGroupRepository,
} from '../../domain/repositories/modifier-group.repository';
import {
  MODIFIER_OPTION_REPOSITORY,
  ModifierOptionRepository,
} from '../../domain/repositories/modifier-option.repository';
import { ModifierGroupNotFound, NoRestaurantInScope } from '../application.errors';

export interface GetModifierGroupInput {
  restaurantId: string | null;
  branchId: string;
  groupId: string;
}

export interface ModifierGroupWithOptions {
  group: ModifierGroup;
  options: ModifierOption[];
}

/** Fetch a single library modifier group with its options (restaurant+branch-scoped). */
@Injectable()
export class GetModifierGroupUseCase implements UseCase<
  GetModifierGroupInput,
  ModifierGroupWithOptions
> {
  constructor(
    @Inject(MODIFIER_GROUP_REPOSITORY) private readonly groups: ModifierGroupRepository,
    @Inject(MODIFIER_OPTION_REPOSITORY) private readonly options: ModifierOptionRepository,
  ) {}

  async execute(input: GetModifierGroupInput): Promise<ModifierGroupWithOptions> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const group = await this.groups.findById(input.restaurantId, input.branchId, input.groupId);
    if (!group) {
      throw ModifierGroupNotFound();
    }
    const options = await this.options.listByGroup(input.restaurantId, input.branchId, group.id);
    return { group, options };
  }
}
