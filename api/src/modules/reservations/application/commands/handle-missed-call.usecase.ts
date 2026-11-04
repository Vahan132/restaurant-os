import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { MissedCall } from '../../domain/entities/missed-call';
import {
  MISSED_CALL_REPOSITORY,
  MissedCallRepository,
} from '../../domain/repositories/missed-call.repository';
import { MissedCallNotFound, NoRestaurantInScope } from '../application.errors';

export interface HandleMissedCallInput {
  restaurantId: string | null;
  branchId: string;
  callId: string;
  actorUserId: string;
}

/** Mark a missed call HANDLED (records who handled it). Tenant-scoped (404 hides). */
@Injectable()
export class HandleMissedCallUseCase implements UseCase<HandleMissedCallInput, MissedCall> {
  constructor(@Inject(MISSED_CALL_REPOSITORY) private readonly missedCalls: MissedCallRepository) {}

  async execute(input: HandleMissedCallInput): Promise<MissedCall> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const call = await this.missedCalls.findById(input.restaurantId, input.branchId, input.callId);
    if (!call) {
      throw MissedCallNotFound();
    }
    call.handle(input.actorUserId);
    await this.missedCalls.save(call);
    return call;
  }
}
