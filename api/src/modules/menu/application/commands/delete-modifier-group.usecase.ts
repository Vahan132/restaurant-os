import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  MODIFIER_GROUP_REPOSITORY,
  ModifierGroupRepository,
} from '../../domain/repositories/modifier-group.repository';
import { ModifierGroupNotFound, NoRestaurantInScope } from '../application.errors';

export interface DeleteModifierGroupInput {
  restaurantId: string | null;
  groupId: string;
}

/** Soft-delete a modifier group (tenant-scoped). */
@Injectable()
export class DeleteModifierGroupUseCase implements UseCase<DeleteModifierGroupInput, void> {
  constructor(
    @Inject(MODIFIER_GROUP_REPOSITORY) private readonly groups: ModifierGroupRepository,
  ) {}

  async execute(input: DeleteModifierGroupInput): Promise<void> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const group = await this.groups.findById(input.restaurantId, input.groupId);
    if (!group) {
      throw ModifierGroupNotFound();
    }
    group.softDelete();
    await this.groups.update(group);
  }
}
