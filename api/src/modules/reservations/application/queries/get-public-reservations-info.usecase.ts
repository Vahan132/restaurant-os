import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  RESERVATION_PUBLIC_INFO_READER,
  ReservationPublicInfo,
  ReservationPublicInfoReader,
} from '../ports/reservation-public-info.reader';

export interface GetPublicReservationsInfoInput {
  restaurantId: string;
  /** BR-9: the resolved branch (from the URL slug). */
  branchId: string;
}

/** Public-safe per-branch info for the booking page (toggle, names, timezone, hours). */
@Injectable()
export class GetPublicReservationsInfoUseCase implements UseCase<
  GetPublicReservationsInfoInput,
  ReservationPublicInfo
> {
  constructor(
    @Inject(RESERVATION_PUBLIC_INFO_READER)
    private readonly reader: ReservationPublicInfoReader,
  ) {}

  execute(input: GetPublicReservationsInfoInput): Promise<ReservationPublicInfo> {
    return this.reader.get(input.restaurantId, input.branchId);
  }
}
