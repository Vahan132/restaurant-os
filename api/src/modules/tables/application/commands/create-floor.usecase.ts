import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { Floor } from '../../domain/entities/floor';
import { FLOOR_REPOSITORY, FloorRepository } from '../../domain/repositories/floor.repository';
import { NoRestaurantInScope } from '../application.errors';

export interface CreateFloorInput {
  restaurantId: string | null;
  name: string;
  description?: string | null;
  displayOrder?: number;
}

/** Create a floor in the tenant's restaurant. */
@Injectable()
export class CreateFloorUseCase implements UseCase<CreateFloorInput, Floor> {
  constructor(
    @Inject(FLOOR_REPOSITORY) private readonly floors: FloorRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateFloorInput): Promise<Floor> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const floor = Floor.create({
      id: this.ids.generate(),
      restaurantId: input.restaurantId,
      name: input.name,
      description: input.description ?? null,
      displayOrder: input.displayOrder,
    });
    await this.floors.create(floor);
    return floor;
  }
}
