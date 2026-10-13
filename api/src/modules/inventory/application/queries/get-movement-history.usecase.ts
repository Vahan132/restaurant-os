import { Inject, Injectable } from '@nestjs/common';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { UseCase } from '../../../../shared/application/use-case';
import { StockMovement } from '../../domain/entities/stock-movement';
import { StockMovementType } from '../../domain/enums';
import {
  STOCK_MOVEMENT_REPOSITORY,
  StockMovementRepository,
} from '../../domain/repositories/stock-movement.repository';
import { InventoryReportScopeService } from '../services/inventory-report-scope.service';

export interface GetMovementHistoryInput {
  organizationId: string;
  restaurantId: string | null;
  userId: string;
  branchId?: string;
  itemId?: string;
  locationId?: string;
  type?: StockMovementType;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

/**
 * Filterable movement-history report (6D): the append-only ledger filtered by
 * item / location / branch / type / date range (combinable, AND), within the
 * caller's branch reach. Extends the INV-1 movement read path with the location
 * dimension rather than duplicating it.
 */
@Injectable()
export class GetMovementHistoryUseCase
  implements UseCase<GetMovementHistoryInput, Paginated<StockMovement>>
{
  constructor(
    private readonly scope: InventoryReportScopeService,
    @Inject(STOCK_MOVEMENT_REPOSITORY) private readonly movements: StockMovementRepository,
  ) {}

  async execute(input: GetMovementHistoryInput): Promise<Paginated<StockMovement>> {
    const scope = await this.scope.resolve(input);
    const query = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(query);
    const { items, total } = await this.movements.list({
      restaurantId: input.restaurantId as string,
      branchIds: scope.branchIds,
      itemId: input.itemId,
      locationId: input.locationId,
      types: input.type ? [input.type] : undefined,
      from: input.from,
      to: input.to,
      skip,
      take,
    });
    return paginate(items, total, query);
  }
}
