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
  data: { operators: HdmOperator[]; departments: HdmDepartment[] } | null;
  operatorFound: boolean | null;
  errorCode: string | null;
  errorMessage: string | null;
  responseHeaderHex: string | null;
  hubAddresses: string[];
  durationMs: number;
}

const post = <T,>(url: string, data?: unknown) => apiRequest<T>({ url, method: 'POST', data });

export const hdmDevice = {
  probe: () => post<HdmProbeResult>('/fiscal/device/probe'),
  testLogin: () => post<{ ok: boolean }>('/fiscal/device/test-login'),
  printLastCopy: () => post<{ ok: boolean }>('/fiscal/device/print-last-copy'),
  xReport: () => post<{ ok: boolean }>('/fiscal/device/report/x'),
  zReport: () => post<{ ok: boolean }>('/fiscal/device/report/z'),
  sync: () => post<{ ok: boolean }>('/fiscal/device/sync'),
};
