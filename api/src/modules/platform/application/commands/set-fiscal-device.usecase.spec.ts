import { AppendAuditLogUseCase } from '../../../audit/application/commands/append-audit-log.usecase';
import {
  FiscalConfigStore,
  SetFiscalDeviceInput,
} from '../../../fiscal-config/application/ports/fiscal-config-store.port';
import { SetFiscalDeviceUseCase } from './set-fiscal-device.usecase';

/**
 * FISCAL-EDGE-6A — set-device. Persists via the store and audits it, with the
 * device password WRITE-ONLY: it reaches the store but never the audit record.
 */

describe('SetFiscalDeviceUseCase', () => {
  it('persists the device and audits it WITHOUT the password', async () => {
    let deviceInput: SetFiscalDeviceInput | null = null;
    const store = {
      setDevice: (i: SetFiscalDeviceInput) => {
        deviceInput = i;
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

    const uc = new SetFiscalDeviceUseCase(store, audit);
    await uc.execute({
      restaurantId: 'r1',
      branchId: 'b1',
      deviceHost: '10.0.0.5',
      devicePort: 9100,
      devicePassword: 'super-secret-pw',
      actorId: 'admin-1',
      ip: '1.2.3.4',
      userAgent: 'jest',
    });

    // Store received the full input (incl. password) for encryption.
    expect(deviceInput).toMatchObject({
      restaurantId: 'r1',
      branchId: 'b1',
      deviceHost: '10.0.0.5',
      devicePort: 9100,
      devicePassword: 'super-secret-pw',
    });

    // Audit was written and NEVER contains the password anywhere.
    expect(auditCalls).toHaveLength(1);
    const audited = auditCalls[0];
    expect(audited.action).toBe('FISCAL_DEVICE_SET');
    expect(audited.newValue).toMatchObject({
      deviceConfigured: true,
      deviceHost: '10.0.0.5',
      devicePort: 9100,
    });
    expect(JSON.stringify(audited)).not.toContain('super-secret-pw');
  });
});
