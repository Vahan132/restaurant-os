'use client';

import { AppShell } from '@/components/shell/AppShell';
import { ShiftReportScreen } from '@/components/reports/ShiftReportScreen';

/**
 * Cashier shift report: today's take at this branch, broken down by payment
 * method. Gated by `reports:shift:view` at the active branch.
 */
export default function ReportsPage() {
  return (
    <AppShell>
      <ShiftReportScreen />
    </AppShell>
  );
}
