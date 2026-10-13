import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  WRITE_OFF_SUMMARY_READER,
  WriteOffSummary,
  WriteOffSummaryReader,
} from '../ports/write-off-summary.reader';
import { NoRestaurantInScope } from '../application.errors';

export interface GetWriteOffSummaryInput {
  restaurantId: string | null;
  branchId: string;
  from?: Date;
  to?: Date;
}

/** Waste totals grouped by reason over a date range (excludes voided). */
@Injectable()
export class GetWriteOffSummaryUseCase implements UseCase<
  GetWriteOffSummaryInput,
  WriteOffSummary
> {
  constructor(@Inject(WRITE_OFF_SUMMARY_READER) private readonly reader: WriteOffSummaryReader) {}

  async execute(input: GetWriteOffSummaryInput): Promise<WriteOffSummary> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    return this.reader.summary({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      from: input.from,
      to: input.to,
    });
  }
}
