import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
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

export interface AddModifierOptionInput {
  restaurantId: string | null;
  branchId: string;
  groupId: string;
  name: string;
  /** LOCALE-2A: optional hy/ru/en translations of the name. */
  nameHy?: string | null;
  nameRu?: string | null;
  nameEn?: string | null;
  priceDeltaAmount?: number;
  sortOrder?: number;
  isDefault?: boolean;
}

/** Add an option to a modifier group (verifies the group belongs to the restaurant). */
@Injectable()
export class AddModifierOptionUseCase implements UseCase<AddModifierOptionInput, ModifierOption> {
  constructor(
    @Inject(MODIFIER_OPTION_REPOSITORY) private readonly options: ModifierOptionRepository,
    @Inject(MODIFIER_GROUP_REPOSITORY) private readonly groups: ModifierGroupRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: AddModifierOptionInput): Promise<ModifierOption> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const group = await this.groups.findById(input.restaurantId, input.branchId, input.groupId);
    if (!group) {
      throw ModifierGroupNotFound();
    }
    const option = ModifierOption.create({
      id: this.ids.generate(),
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      modifierGroupId: input.groupId,
      name: input.name,
      nameHy: input.nameHy,
      nameRu: input.nameRu,
      nameEn: input.nameEn,
      priceDeltaAmount: input.priceDeltaAmount, // may be 0 or negative (Prompt 1A)
      sortOrder: input.sortOrder,
      isDefault: input.isDefault,
    });
    await this.options.create(option);
    return option;
  }
}
