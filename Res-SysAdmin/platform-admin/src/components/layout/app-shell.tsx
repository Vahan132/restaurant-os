"use client";

import type { ReactNode } from "react";
import { AuthGuard } from "@/components/layout/auth-guard";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}

/** Standard page header used at the top of each route. */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-gray-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
