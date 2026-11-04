import { Inject, Injectable } from '@nestjs/common';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { UseCase } from '../../../../shared/application/use-case';
import { WriteOff } from '../../domain/entities/write-off';
import { WriteOffLineKind, WriteOffReason } from '../../domain/enums';
import {
  WRITE_OFF_REPOSITORY,
  WriteOffRepository,
} from '../../domain/repositories/write-off.repository';
import { NoRestaurantInScope } from '../application.errors';

export interface ListWriteOffsInput {
  restaurantId: string | null;
  branchId: string;
  reason?: WriteOffReason;
  kind?: WriteOffLineKind;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

@Injectable()
export class ListWriteOffsUseCase implements UseCase<ListWriteOffsInput, Paginated<WriteOff>> {
  constructor(@Inject(WRITE_OFF_REPOSITORY) private readonly writeOffs: WriteOffRepository) {}

  async execute(input: ListWriteOffsInput): Promise<Paginated<WriteOff>> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const query = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(query);
    const { items, total } = await this.writeOffs.list({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      reason: input.reason,
      kind: input.kind,
      occurredFrom: input.from,
      occurredTo: input.to,
      skip,
      take,
    });
    return paginate(items, total, query);
  }
}
