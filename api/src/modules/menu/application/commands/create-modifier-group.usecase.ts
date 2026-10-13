import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { ModifierGroup } from '../../domain/entities/modifier-group';
import { ModifierSelectionType } from '../../domain/enums';
import {
  MODIFIER_GROUP_REPOSITORY,
  ModifierGroupRepository,
} from '../../domain/repositories/modifier-group.repository';
import { NoRestaurantInScope } from '../application.errors';

export interface CreateModifierGroupInput {
  restaurantId: string | null;
  branchId: string;
  name: string;
  /** LOCALE-2A: optional hy/ru/en translations of the name. */
  nameHy?: string | null;
  nameRu?: string | null;
  nameEn?: string | null;
  selectionType: ModifierSelectionType;
  required?: boolean;
  minSelect?: number | null;
  maxSelect?: number | null;
}

/** Create a reusable modifier group in the restaurant+branch library (Prompt 1A). */
@Injectable()
export class CreateModifierGroupUseCase implements UseCase<
  CreateModifierGroupInput,
  ModifierGroup
> {
  constructor(
    @Inject(MODIFIER_GROUP_REPOSITORY) private readonly groups: ModifierGroupRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateModifierGroupInput): Promise<ModifierGroup> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const group = ModifierGroup.create({
      id: this.ids.generate(),
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      name: input.name,
      nameHy: input.nameHy,
      nameRu: input.nameRu,
      nameEn: input.nameEn,
      selectionType: input.selectionType,
      required: input.required,
      minSelect: input.minSelect ?? null,
      maxSelect: input.maxSelect ?? null,
    });
    await this.groups.create(group);
    return group;
  }
}
