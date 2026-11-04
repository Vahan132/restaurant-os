import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  MODIFIER_OPTION_REPOSITORY,
  ModifierOptionRepository,
} from '../../domain/repositories/modifier-option.repository';
import { ModifierOptionNotFound, NoRestaurantInScope } from '../application.errors';

export interface DeleteModifierOptionInput {
  restaurantId: string | null;
  branchId: string;
  optionId: string;
}

/** Soft-delete a modifier option (tenant-scoped). */
@Injectable()
export class DeleteModifierOptionUseCase implements UseCase<DeleteModifierOptionInput, void> {
  constructor(
    @Inject(MODIFIER_OPTION_REPOSITORY) private readonly options: ModifierOptionRepository,
  ) {}

  async execute(input: DeleteModifierOptionInput): Promise<void> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const option = await this.options.findById(input.restaurantId, input.branchId, input.optionId);
    if (!option) {
      throw ModifierOptionNotFound();
    }
    option.softDelete();
    await this.options.update(option);
  }
}
