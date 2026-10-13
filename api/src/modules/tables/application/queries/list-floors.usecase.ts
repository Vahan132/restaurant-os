import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Floor } from '../../domain/entities/floor';
import { ZoneStatus } from '../../domain/enums';
import { FLOOR_REPOSITORY, FloorRepository } from '../../domain/repositories/floor.repository';
import { NoRestaurantInScope } from '../application.errors';

export interface ListFloorsInput {
  restaurantId: string | null;
  branchId: string;
  status?: ZoneStatus;
  includeInactive?: boolean;
}

/** List floors ordered by displayOrder (tenant-scoped). */
@Injectable()
export class ListFloorsUseCase implements UseCase<ListFloorsInput, Floor[]> {
  constructor(@Inject(FLOOR_REPOSITORY) private readonly floors: FloorRepository) {}

  execute(input: ListFloorsInput): Promise<Floor[]> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    return this.floors.list({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      status: input.status,
      includeInactive: input.includeInactive,
    });
  }
}
