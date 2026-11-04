'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/api/mutator';
import { useAuthStore } from '@/stores/auth';
import { useBranchStore } from '@/stores/branch';

/** One payment method's take for the day. Amounts are integer minor units. */
export interface ShiftPaymentMethodRow {
  method: string;
  amount: number;
  paymentCount: number;
}

export interface ShiftReport {
  /** Business day reported on (YYYY-MM-DD, restaurant tz). */
  date: string;
  branchId: string;
  rows: ShiftPaymentMethodRow[];
  totalAmount: number;
  paymentCount: number;
  orderCount: number;
}

/**
 * Cashier shift report: GET /reports/pos/payment-methods for the terminal's
 * active branch. `X-Branch-Id` is attached by the axios mutator, so the branch
 * never has to be passed here — the backend resolves and validates it, and the
 * cache key carries it so switching branch can't show the previous one's take.
 *
 * Hand-written rather than generated because the endpoint is newer than the
 * checked-in openapi.json; it goes through the same `apiRequest` wrapper every
 * generated hook uses (envelope unwrapping, 401 refresh, error normalization),
 * so it can be swapped for the generated hook after the next `orval` run.
 */
export function useShiftReport(date?: string) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const branchId = useBranchStore((s) => s.activeBranchId);

  return useQuery({
    queryKey: ['shiftReport', branchId, date ?? 'today'],
    enabled: Boolean(accessToken && branchId),
    // Payments land throughout a shift, so keep it short and refetch on focus.
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    queryFn: () =>
      apiRequest<ShiftReport>({
        url: '/reports/pos/payment-methods',
        method: 'GET',
        params: date ? { date } : undefined,
      }),
  });
}
