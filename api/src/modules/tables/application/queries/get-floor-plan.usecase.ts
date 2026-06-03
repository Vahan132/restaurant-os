import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { NoRestaurantInScope } from '../application.errors';
import { FLOOR_PLAN_READER, FloorPlanFloor, FloorPlanReader } from '../ports/floor-plan.reader';

export interface GetFloorPlanInput {
  restaurantId: string | null;
}

/** Read model: ACTIVE floors (ordered) -> their tables with current status. */
@Injectable()
export class GetFloorPlanUseCase implements UseCase<GetFloorPlanInput, FloorPlanFloor[]> {
  constructor(@Inject(FLOOR_PLAN_READER) private readonly reader: FloorPlanReader) {}

  execute(input: GetFloorPlanInput): Promise<FloorPlanFloor[]> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    return this.reader.getFloorPlan(input.restaurantId);
  }
}
