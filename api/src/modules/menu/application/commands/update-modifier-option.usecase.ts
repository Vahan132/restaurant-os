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
  optionId: string;
  name?: string;
  priceDeltaAmount?: number;
  displayOrder?: number;
  status?: MenuStatus;
}

/** Update a modifier option (tenant-scoped). Rejects negative price deltas. */
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
    const option = await this.options.findById(input.restaurantId, input.optionId);
    if (!option) {
      throw ModifierOptionNotFound();
    }
    option.update({
      name: input.name,
      priceDeltaAmount: input.priceDeltaAmount,
      displayOrder: input.displayOrder,
      status: input.status,
    });
    await this.options.update(option);
    return option;
  }
}
