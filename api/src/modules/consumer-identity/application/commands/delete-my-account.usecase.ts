import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { CancelReservationUseCase } from '../../../reservations/application/commands/cancel-reservation.usecase';
import {
  CUSTOMER_ACCOUNT_REPOSITORY,
  CustomerAccountRepository,
} from '../../domain/repositories/customer-account.repository';
import {
  CONSUMER_RESERVATION_LINK,
  ConsumerReservationLink,
} from '../ports/consumer-reservation-link';

export interface DeleteMyAccountInput {
  customerAccountId: string;
}

const DELETE_REASON = 'ACCOUNT_DELETED';
const DELETED_USER_PLACEHOLDER = 'Deleted user';
const ACTIVE_STATUSES = new Set(['PENDING', 'CONFIRMED', 'ARRIVED', 'SEATED']);

/**
 * Delete-account (locked semantics):
 *   - NO reservation rows are deleted.
 *   - FUTURE active bookings are cancelled through the REAL CancelReservationUseCase
 *     (so the table is released back to availability).
 *   - PAST active bookings are marked CANCELLED in place.
 *   - the consumer link + denormalized PII are severed on ALL the consumer's
 *     reservations (shown as a "deleted user" placeholder).
 *   - then the CustomerAccount + identities + refresh tokens are HARD-deleted
 *     (Prisma cascade).
 * Idempotent: a second call (account already gone) is a no-op.
 */
@Injectable()
export class DeleteMyAccountUseCase implements UseCase<DeleteMyAccountInput, void> {
  constructor(
    @Inject(CUSTOMER_ACCOUNT_REPOSITORY) private readonly accounts: CustomerAccountRepository,
    @Inject(CONSUMER_RESERVATION_LINK) private readonly reservations: ConsumerReservationLink,
    private readonly cancelReservation: CancelReservationUseCase,
  ) {}

  async execute(input: DeleteMyAccountInput): Promise<void> {
    const account = await this.accounts.findById(input.customerAccountId);
    if (!account) return; // idempotent

    const now = Date.now();
    const linked = await this.reservations.listByConsumer(input.customerAccountId);

    for (const r of linked) {
      const isActive = ACTIVE_STATUSES.has(r.status);
      if (!isActive) continue; // completed/cancelled/no-show: leave status, just anonymize
      if (r.reservedAt.getTime() > now) {
        // Future → cancel via the real path (releases the table). Tolerate races.
        try {
          await this.cancelReservation.execute({
            restaurantId: r.restaurantId,
            branchId: r.branchId,
            reservationId: r.id,
            reason: DELETE_REASON,
            actorUserId: null,
          });
        } catch {
          await this.reservations.markCancelledInPlace(r.id, DELETE_REASON);
        }
      } else {
        // Past → mark cancelled in place.
        await this.reservations.markCancelledInPlace(r.id, DELETE_REASON);
      }
    }

    // Sever link + PII on ALL the consumer's reservations (rows preserved).
    await this.reservations.anonymizeAll(input.customerAccountId, DELETED_USER_PLACEHOLDER);

    // Hard-delete account (cascades identities + refresh tokens; saved list when CX-3).
    await this.accounts.hardDelete(input.customerAccountId);
  }
}
