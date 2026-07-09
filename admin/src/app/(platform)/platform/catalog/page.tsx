import { CatalogManager } from '@/components/platform-catalog/catalog-manager';
import { PlatformAuthGuard } from '@/components/platform/platform-auth-guard';
import { PlatformShell } from '@/components/platform/platform-shell';

export default function PlatformCatalogPage() {
  return (
    <PlatformAuthGuard>
      <PlatformShell>
        <CatalogManager />
      </PlatformShell>
    </PlatformAuthGuard>
  );
}
