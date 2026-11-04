import { FiscalConfigManager } from '@/components/platform/fiscal-config-manager';
import { PlatformAuthGuard } from '@/components/platform/platform-auth-guard';
import { PlatformShell } from '@/components/platform/platform-shell';

export default function PlatformFiscalConfigPage() {
  return (
    <PlatformAuthGuard>
      <PlatformShell>
        <FiscalConfigManager />
      </PlatformShell>
    </PlatformAuthGuard>
  );
}
