import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ModifierOption } from '../../domain/entities/modifier-option';
import { MenuStatus } from '../../domain/enums';
import {
  MODIFIER_OPTION_REPOSITORY,
  ModifierOptionRepository,
} from '../../domain/repositories/modifier-option.repository';
import { ModifierOptionNotFound, NoRestaurantInScope } from '../application.errors';

export interface UpdateModifierOptionInput {
  restaurantId: string | null;
  branchId: string;
  optionId: string;
  name?: string;
  priceDeltaAmount?: number;
  sortOrder?: number;
  isDefault?: boolean;
  status?: MenuStatus;
}

/** Update a modifier option (tenant-scoped). Price deltas may be 0 or negative. */
@Injectable()
export class UpdateModifierOptionUseCase implements UseCase<
  UpdateModifierOptionInput,
  ModifierOption
> {
  constructor(
    @Inject(MODIFIER_OPTION_REPOSITORY) private readonly options: ModifierOptionRepository,
  ) {}

  async execute(input: UpdateModifierOptionInput): Promise<ModifierOption> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const option = await this.options.findById(input.restaurantId, input.branchId, input.optionId);
    if (!option) {
      throw ModifierOptionNotFound();
    }
    option.update({
      name: input.name,
      priceDeltaAmount: input.priceDeltaAmount,
      sortOrder: input.sortOrder,
      isDefault: input.isDefault,
      status: input.status,
    });
    await this.options.update(option);
    return option;
  }
}
