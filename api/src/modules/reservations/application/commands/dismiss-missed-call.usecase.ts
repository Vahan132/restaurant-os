import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { MissedCall } from '../../domain/entities/missed-call';
import {
  MISSED_CALL_REPOSITORY,
  MissedCallRepository,
} from '../../domain/repositories/missed-call.repository';
import { MissedCallNotFound, NoRestaurantInScope } from '../application.errors';

export interface DismissMissedCallInput {
  restaurantId: string | null;
  branchId: string;
  callId: string;
  actorUserId: string;
}

/** Mark a missed call DISMISSED. Tenant-scoped (404 hides cross-tenant rows). */
@Injectable()
export class DismissMissedCallUseCase implements UseCase<DismissMissedCallInput, MissedCall> {
  constructor(@Inject(MISSED_CALL_REPOSITORY) private readonly missedCalls: MissedCallRepository) {}

  async execute(input: DismissMissedCallInput): Promise<MissedCall> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const call = await this.missedCalls.findById(input.restaurantId, input.branchId, input.callId);
    if (!call) {
      throw MissedCallNotFound();
    }
    call.dismiss(input.actorUserId);
    await this.missedCalls.save(call);
    return call;
  }
}
