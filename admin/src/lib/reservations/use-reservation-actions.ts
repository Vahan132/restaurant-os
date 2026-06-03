'use client';

import { useTranslations } from 'next-intl';

import {
  useReservationsControllerArrive,
  useReservationsControllerAssign,
  useReservationsControllerCancel,
  useReservationsControllerClear,
  useReservationsControllerComplete,
  useReservationsControllerConfirm,
  useReservationsControllerNoShow,
  useReservationsControllerSeat,
} from '@/api/generated/reservations/reservations';
import { getErrorMessage, isApiError } from '@/lib/api-error';
import type { ReservationAction } from '@/lib/reservations/transitions';
import { useReservationsInvalidation } from '@/lib/reservations/use-reservations-data';
import { toast } from '@/stores/toast';

export type RunnableAction = ReservationAction | 'assign' | 'clear';

/**
 * Dispatches a reservation status action to its dedicated endpoint, then
 * toasts + invalidates. Handles RESERVATIONS_DISABLED and state-machine
 * rejections as clear toasts. Returns true on success.
 */
export function useReservationActions() {
  const t = useTranslations('reservations');
  const invalidate = useReservationsInvalidation();

  const confirm = useReservationsControllerConfirm();
  const arrive = useReservationsControllerArrive();
  const seat = useReservationsControllerSeat();
  const complete = useReservationsControllerComplete();
  const noShow = useReservationsControllerNoShow();
  const cancel = useReservationsControllerCancel();
  const assign = useReservationsControllerAssign();
  const clear = useReservationsControllerClear();

  const isPending =
    confirm.isPending ||
    arrive.isPending ||
    seat.isPending ||
    complete.isPending ||
    noShow.isPending ||
    cancel.isPending ||
    assign.isPending ||
    clear.isPending;

  const run = async (
    action: RunnableAction,
    id: string,
    extra?: { reason?: string; tableId?: string },
  ): Promise<boolean> => {
    try {
      switch (action) {
        case 'confirm':
          await confirm.mutateAsync({ id });
          toast.success(t('toast.confirmed'));
          break;
        case 'arrive':
          await arrive.mutateAsync({ id });
          toast.success(t('toast.arrived'));
          break;
        case 'seat':
          await seat.mutateAsync({ id });
          toast.success(t('toast.seated'));
          break;
        case 'complete':
          await complete.mutateAsync({ id });
          toast.success(t('toast.completed'));
          break;
        case 'noShow':
          await noShow.mutateAsync({ id });
          toast.success(t('toast.noShowSet'));
          break;
        case 'cancel':
          await cancel.mutateAsync({ id, data: { reason: extra?.reason } });
          toast.success(t('toast.cancelled'));
          break;
        case 'assign':
          await assign.mutateAsync({ id, data: { tableId: extra!.tableId! } });
          toast.success(t('toast.tableAssigned'));
          break;
        case 'clear':
          await clear.mutateAsync({ id });
          toast.success(t('toast.tableCleared'));
          break;
      }
      await invalidate(id);
      return true;
    } catch (err) {
      if (isApiError(err) && err.code === 'RESERVATIONS_DISABLED') {
        toast.error(t('disabledError'));
      } else {
        toast.error(getErrorMessage(err));
      }
      return false;
    }
  };

  return { run, isPending };
}
