import { AppendAuditLogUseCase } from '../../../audit/application/commands/append-audit-log.usecase';
import { FiscalConfigStore } from '../../../fiscal-config/application/ports/fiscal-config-store.port';
import { FiscalPrintMode } from '../../../fiscal-config/application/ports/fiscal-print-mode.reader';
import { SetFiscalPrintModeUseCase } from './set-fiscal-print-mode.usecase';

/** FISCAL-EDGE-6A — set-print-mode. Persists AUTO↔MANUAL via the store + audits it. */

describe('SetFiscalPrintModeUseCase', () => {
  it('persists the mode and audits FISCAL_PRINT_MODE_SET', async () => {
    const calls: Array<[string, string, FiscalPrintMode]> = [];
    const store = {
      setPrintMode: (r: string, b: string, m: FiscalPrintMode) => {
        calls.push([r, b, m]);
        return Promise.resolve();
      },
    } as unknown as FiscalConfigStore;

    const auditCalls: Record<string, unknown>[] = [];
    const audit = {
      execute: (i: Record<string, unknown>) => {
        auditCalls.push(i);
        return Promise.resolve();
      },
    } as unknown as AppendAuditLogUseCase;

    const uc = new SetFiscalPrintModeUseCase(store, audit);
    await uc.execute({
      restaurantId: 'r1',
      branchId: 'b1',
      fiscalPrintMode: 'MANUAL',
      actorId: 'admin-1',
    });

    expect(calls).toEqual([['r1', 'b1', 'MANUAL']]);
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]).toMatchObject({
      action: 'FISCAL_PRINT_MODE_SET',
      newValue: { fiscalPrintMode: 'MANUAL' },
    });
  });
});
