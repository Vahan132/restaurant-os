"use client";

import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/primitives";
import { useLogout } from "@/hooks/use-auth";

export function Topbar() {
  const user = useAuthStore((s) => s.platformUser);
  const { logout, loading } = useLogout();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">{user?.fullName ?? "—"}</p>
          <p className="text-xs text-gray-500">
            {user?.email}
            {user?.role ? ` · ${user.role}` : ""}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => logout()} loading={loading}>
          Log out
        </Button>
      </div>
    </header>
  );
}
