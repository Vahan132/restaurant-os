'use client';

/**
 * PAYNET-1 — branch "Online payments" settings API (hand-written until the next
 * orval regeneration picks up /payments/settings from the spec). The active
 * branch is sent as X-Branch-Id by the mutator.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customInstance } from '@/api/mutator';
import { useActiveBranchStore } from '@/stores/active-branch';

export interface PaymentProviderStatus {
  id: string;
  provider: 'PAYNET';
  enabled: boolean;
  livemode: boolean;
  apiKeyConfigured: boolean;
  apiKeyLast4: string | null;
  webhookSecretConfigured: boolean;
  domain: string | null;
  processor: string | null;
  lastCheckAt: string | null;
  lastCheckOk: boolean | null;
  lastCheckError: string | null;
  updatedAt: string;
}

export interface PaymentSettings {
  status: PaymentProviderStatus | null;
  webhookUrl: string | null;
}

export interface SavePaymentSettings {
  enabled: boolean;
  apiKey?: string;
  webhookSecret?: string;
  domain?: string | null;
  processor?: string | null;
}

export interface PaymentCheck {
  ok: boolean;
  livemode: boolean;
  errorCode: string | null;
  errorMessage: string | null;
}

const KEY = 'payments-settings';

export function usePaymentSettings() {
  const branchId = useActiveBranchStore((s) => s.activeBranchId);
  return useQuery({
    queryKey: [KEY, branchId],
    queryFn: () => customInstance<PaymentSettings>({ url: '/payments/settings', method: 'GET' }),
    enabled: branchId !== null,
  });
}

export function useSavePaymentSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SavePaymentSettings) =>
      customInstance<PaymentSettings>({ url: '/payments/settings', method: 'PUT', data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useCheckPaymentSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => customInstance<PaymentCheck>({ url: '/payments/settings/check', method: 'POST' }),
    onSettled: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useTestPayment() {
  return useMutation({
    mutationFn: (data: { amount: number; returnUrl: string }) =>
      customInstance<{ checkoutUrl: string; uuid: string }>({
        url: '/payments/settings/test-payment',
        method: 'POST',
        data,
      }),
  });
}
