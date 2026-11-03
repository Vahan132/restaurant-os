'use client';

/**
 * PIN-UNLOCK-1 — branch staff PIN status + unlock. Hand-written until the next
 * orval regeneration; the mutator sends X-Branch-Id. Works on the cloud and on
 * the local hub (same endpoints).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customInstance } from '@/api/mutator';
import { useActiveBranchStore } from '@/stores/active-branch';

export interface StaffPinStatus {
  userId: string;
  fullName: string;
  roleName: string | null;
  pinStatus: 'ACTIVE' | 'REVOKED' | 'NONE';
  locked: boolean;
  lockedUntil: string | null;
  failedAttempts: number;
  mustRotate: boolean;
}

const KEY = 'staff-pin-status';

export function useStaffPinStatus() {
  const branchId = useActiveBranchStore((s) => s.activeBranchId);
  return useQuery({
    queryKey: [KEY, branchId],
    // The API envelopes bare arrays as { data, pagination }, which the mutator
    // unwraps to { items, pagination } — normalise to a plain array.
    queryFn: async (): Promise<StaffPinStatus[]> => {
      const res = await customInstance<
        StaffPinStatus[] | { items?: StaffPinStatus[] }
      >({ url: '/staff-pins/status', method: 'GET' });
      if (Array.isArray(res)) return res;
      return Array.isArray(res?.items) ? res.items : [];
    },
    enabled: branchId !== null,
    refetchInterval: 15_000,
  });
}

export function useUnlockStaffPin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      customInstance<{ success: true }>({
        url: `/staff-pins/${encodeURIComponent(userId)}/unlock`,
        method: 'POST',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
