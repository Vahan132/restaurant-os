import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { WriteOff } from '../../domain/entities/write-off';
import { WRITE_OFF_REF_TYPE } from '../../domain/enums';
import {
  STOCK_CONSUMPTION_PORT,
  StockConsumptionPort,
} from '../../domain/ports/stock-consumption.port';
import {
  WRITE_OFF_REPOSITORY,
  WriteOffRepository,
} from '../../domain/repositories/write-off.repository';
import { NoRestaurantInScope, WriteOffNotFound } from '../application.errors';

export interface VoidWriteOffInput {
  restaurantId: string | null;
  branchId: string;
  writeOffId: string;
  actorUserId: string;
}

/**
 * Void a write-off: reverse its WRITE_OFF stock consumption (restores layers,
 * emits CONSUMPTION_REVERSAL) and stamp voidedAt/voidedByUserId. Rejects a
 * second void with WRITE_OFF_ALREADY_VOIDED; the underlying reversal is
 * inherently idempotent.
 */
@Injectable()
export class VoidWriteOffUseCase implements UseCase<VoidWriteOffInput, WriteOff> {
  constructor(
    @Inject(WRITE_OFF_REPOSITORY) private readonly writeOffs: WriteOffRepository,
    @Inject(STOCK_CONSUMPTION_PORT) private readonly consumption: StockConsumptionPort,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: VoidWriteOffInput): Promise<WriteOff> {
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

    // Mark voided first (throws WRITE_OFF_ALREADY_VOIDED if already voided) so a
    // re-void never even reaches the reversal.
    writeOff.void(input.actorUserId);

    await this.consumption.reverse({
      restaurantId: input.restaurantId,
      refType: WRITE_OFF_REF_TYPE,
      refId: writeOff.id,
      createdByUserId: input.actorUserId,
    });
    await this.writeOffs.update(writeOff);
    await this.events.publishFromAggregate(writeOff);
    return writeOff;
  }
}
