import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { WriteOff } from '../../domain/entities/write-off';
import {
  WRITE_OFF_REPOSITORY,
  WriteOffRepository,
} from '../../domain/repositories/write-off.repository';
import { NoRestaurantInScope, WriteOffNotFound } from '../application.errors';

export interface GetWriteOffInput {
  restaurantId: string | null;
  branchId: string;
  writeOffId: string;
}

@Injectable()
export class GetWriteOffUseCase implements UseCase<GetWriteOffInput, WriteOff> {
  constructor(@Inject(WRITE_OFF_REPOSITORY) private readonly writeOffs: WriteOffRepository) {}

  async execute(input: GetWriteOffInput): Promise<WriteOff> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const writeOff = await this.writeOffs.findById(
      input.restaurantId,
      input.branchId,
      input.writeOffId,
    );
    if (!writeOff) {
      throw WriteOffNotFound();
    }
    return writeOff;
  }
}
