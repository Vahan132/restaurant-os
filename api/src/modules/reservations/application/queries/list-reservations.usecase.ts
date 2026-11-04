import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  Paginated,
  normalizePagination,
  paginate,
  toSkipTake,
} from '../../../../shared/application/pagination';
import { Reservation } from '../../domain/entities/reservation';
import { ReservationStatus } from '../../domain/enums';
import {
  RESERVATION_REPOSITORY,
  ReservationRepository,
} from '../../domain/repositories/reservation.repository';
import { NoRestaurantInScope } from '../application.errors';
import {
  RESERVATION_SETTINGS_READER,
  ReservationSettingsReader,
} from '../ports/reservation-settings.reader';
import { zonedDayRange } from '../timezone.util';

export interface ListReservationsInput {
  restaurantId: string | null;
  branchId: string;
  date?: string; // YYYY-MM-DD (restaurant timezone)
  status?: ReservationStatus;
  tableId?: string;
  page: number;
  limit: number;
}

/** Daily/filtered reservation list, ordered by reservedAt ascending. */
@Injectable()
export class ListReservationsUseCase implements UseCase<
  ListReservationsInput,
  Paginated<Reservation>
> {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepository,
    @Inject(RESERVATION_SETTINGS_READER) private readonly settings: ReservationSettingsReader,
  ) {}

  async execute(input: ListReservationsInput): Promise<Paginated<Reservation>> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const pagination = normalizePagination({ page: input.page, limit: input.limit });
    const { skip, take } = toSkipTake(pagination);

    let reservedFrom: Date | undefined;
    let reservedTo: Date | undefined;
    if (input.date) {
      const { timezone } = await this.settings.get(input.restaurantId);
      const range = zonedDayRange(input.date, timezone);
      reservedFrom = range.start;
      reservedTo = range.end;
    }

    const { items, total } = await this.reservations.list({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      status: input.status,
      tableId: input.tableId,
      reservedFrom,
      reservedTo,
      skip,
      take,
    });
    return paginate(items, total, pagination);
  }
}
