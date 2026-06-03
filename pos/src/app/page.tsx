'use client';

import { AppShell } from '@/components/shell/AppShell';
import { TableSelectHome } from '@/components/tables/TableSelectHome';

/**
 * Home = table-select workflow screen. The active workflow renders inside the
 * POS shell; P2 will route from a tapped table into the order workflow.
 */
export default function HomePage() {
  return (
    <AppShell>
      <TableSelectHome />
    </AppShell>
  );
}
