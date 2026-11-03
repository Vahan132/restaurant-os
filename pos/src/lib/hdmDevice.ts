/**
 * HDM-TM-1 — calls for the on-site physical HDM (TouchMaster etc.). These
 * endpoints exist on the LOCAL HUB only (the HDM is on the restaurant LAN); on
 * the cloud they answer 409 FISCALIZE_HUB_ONLY. Hand-written (not orval) until
 * the next `pnpm api:generate` picks them up from the spec.
 */
import { apiRequest } from '@/api/mutator';

export interface HdmOperator {
  id: number;
  name: string;
  deps: number[];
}
export interface HdmDepartment {
  id: number;
  name: string;
  type: number;
}
export interface HdmProbeResult {
  ok: boolean;
  host: string;
  port: number;
  /** Operators + departments read from the device (null when unreachable). */
  device?: { operators: HdmOperator[]; departments: HdmDepartment[] } | null;
  /** Older hubs named it `data` (unwrapped by the envelope — see normalizeProbe). */
  data?: { operators: HdmOperator[]; departments: HdmDepartment[] } | null;
  operatorFound: boolean | null;
  errorCode: string | null;
  errorMessage: string | null;
  responseHeaderHex: string | null;
  hubAddresses: string[];
  durationMs: number;
}

/**
 * HDM-EDGE-2: accept every shape the probe can arrive in. An older hub returned
 * the device info under `data`, which the mutator's envelope unwrap mistook for
 * the whole payload (only `{operators, departments}` survived) → the panel
 * crashed. Never let a partial payload break the page.
 */
function normalizeProbe(raw: unknown): HdmProbeResult {
  const r = (raw ?? {}) as Partial<HdmProbeResult> & {
    operators?: HdmOperator[];
    departments?: HdmDepartment[];
  };
  // Unwrapped-to-inner case: we only got { operators, departments }.
  const innerOnly = Array.isArray(r.operators) || Array.isArray(r.departments);
  const dev = innerOnly
    ? { operators: r.operators ?? [], departments: r.departments ?? [] }
    : (r.device ?? r.data ?? null);
  return {
    ok: innerOnly ? true : Boolean(r.ok),
    host: r.host ?? '',
    port: r.port ?? 0,
    device: dev
      ? { operators: dev.operators ?? [], departments: dev.departments ?? [] }
      : null,
    operatorFound: r.operatorFound ?? null,
    errorCode: r.errorCode ?? null,
    errorMessage: r.errorMessage ?? null,
    responseHeaderHex: r.responseHeaderHex ?? null,
    hubAddresses: Array.isArray(r.hubAddresses) ? r.hubAddresses : [],
    durationMs: r.durationMs ?? 0,
  };
}

const post = <T,>(url: string, data?: unknown) => apiRequest<T>({ url, method: 'POST', data });

export const hdmDevice = {
  probe: async (): Promise<HdmProbeResult> =>
    normalizeProbe(await post<unknown>('/fiscal/device/probe')),
  testLogin: () => post<{ ok: boolean }>('/fiscal/device/test-login'),
  printLastCopy: () => post<{ ok: boolean }>('/fiscal/device/print-last-copy'),
  xReport: () => post<{ ok: boolean }>('/fiscal/device/report/x'),
  zReport: () => post<{ ok: boolean }>('/fiscal/device/report/z'),
  sync: () => post<{ ok: boolean }>('/fiscal/device/sync'),
};
