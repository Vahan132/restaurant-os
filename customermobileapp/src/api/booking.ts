/**
 * Consumer Booking client hub (CX-APP-3).
 *
 * Single re-export point for the orval-generated Consumer Booking hooks + types, plus
 * a helper to invalidate the reservations lists after a create/cancel mutation.
 *
 * Generated from operationIds:
 *   ConsumerBookingController_slots / create / list / cancel  (tag "Consumer Booking")
 */
import {
  useConsumerBookingControllerSlots,
  useConsumerBookingControllerList,
  useConsumerBookingControllerCreate,
  useConsumerBookingControllerCancel,
} from './generated/consumer-booking/consumer-booking';
import { queryClient } from './query-client';

export {
  useConsumerBookingControllerSlots as useSlots,
  useConsumerBookingControllerList as useReservations,
  useConsumerBookingControllerCreate as useCreateReservation,
  useConsumerBookingControllerCancel as useCancelReservation,
};

export type {
  ConsumerBookableSlotsResponse,
  BookableSlotResponse,
  ConsumerBookingControllerListParams,
  ConsumerBookingControllerSlotsParams,
  ConsumerReservationResponse,
  ConsumerReservationConfirmationResponse,
  CreateConsumerReservationDto,
} from './generated/model';

export { ConsumerBookingControllerListScope } from './generated/model';

/** Base key for every `/consumer/reservations` list query (any scope/page). */
export const RESERVATIONS_BASE_KEY = '/consumer/reservations';

/** Invalidate all reservations lists (upcoming + past, all pages). */
export function invalidateReservations(): void {
  void queryClient.invalidateQueries({
    predicate: (q) => q.queryKey[0] === RESERVATIONS_BASE_KEY,
  });
}
