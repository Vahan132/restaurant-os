'use client';

/**
 * HDM-TM-2 — the active branch's own HDM settings (restaurant admin). Hand-written
 * until the next orval regeneration; the mutator sends X-Branch-Id.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customInstance } from '@/api/mutator';
import { useActiveBranchStore } from '@/stores/active-branch';

export interface BranchFiscalDepartment {
  dep: string;
  taxRegime: string;
  label: string | null;
}

export interface BranchFiscalSettings {
  active: boolean;
  crn: string;
  deviceHost: string | null;
  devicePort: number | null;
  deviceConfigured: boolean;
  deviceCashierId: number | null;
  devicePinConfigured: boolean;
  deviceUseExtPos: boolean;
  fiscalPrintMode: 'AUTO' | 'MANUAL';
  departments: BranchFiscalDepartment[];
  updatedAt: string;
}

export interface SaveBranchHdm {
  active: boolean;
  crn?: string | null;
  host: string;
  port: number;
  password?: string;
  cashierId?: number | null;
  pin?: string;
  useExtPos?: boolean;
  printMode?: 'AUTO' | 'MANUAL';
}

type Res = { settings: BranchFiscalSettings | null };
const KEY = 'branch-fiscal-settings';

export function useBranchFiscalSettings() {
  const branchId = useActiveBranchStore((s) => s.activeBranchId);
  return useQuery({
    queryKey: [KEY, branchId],
    queryFn: () => customInstance<Res>({ url: '/fiscal/settings', method: 'GET' }),
    enabled: branchId !== null,
  });
}

export function useSaveBranchHdm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveBranchHdm) => customInstance<Res>({ url: '/fiscal/settings/hdm', method: 'PUT', data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useSaveBranchDepartments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (departments: { dep: string; taxRegime: string; label: string | null }[]) =>
      customInstance<Res>({ url: '/fiscal/settings/departments', method: 'PUT', data: { departments } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
