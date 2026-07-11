"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  usePlatformAuthControllerLogin,
  usePlatformAuthControllerLogout,
  platformAuthControllerMe,
} from "@/api/generated/endpoints/platform-auth/platform-auth";
import { useAuthStore } from "@/stores/auth-store";
import { getErrorMessage } from "@/lib/errors";

/**
 * Login flow: POST /platform/auth/login -> persist tokens -> GET /platform/auth/me
 * -> store platform user -> redirect to dashboard.
 */
export function useLogin() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const setPlatformUser = useAuthStore((s) => s.setPlatformUser);
  const [error, setError] = useState<string | null>(null);
  const mutation = usePlatformAuthControllerLogin();

  async function login(email: string, password: string) {
    setError(null);
    try {
      const tokens = await mutation.mutateAsync({ data: { email, password } });
      setSession({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
      // Confirm the session by loading the current platform user.
      const me = await platformAuthControllerMe();
      setPlatformUser(me ?? tokens.user ?? null);
      router.replace("/");
    } catch (err) {
      setError(getErrorMessage(err, "Invalid email or password"));
    }
  }

  return { login, loading: mutation.isPending, error };
}

/** Logout: POST /platform/auth/logout (best effort) then clear the store. */
export function useLogout() {
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);
  const queryClient = useQueryClient();
  const mutation = usePlatformAuthControllerLogout();

  async function logout() {
    const refreshToken = useAuthStore.getState().refreshToken;
    try {
      if (refreshToken) {
        await mutation.mutateAsync({ data: { refreshToken } });
      }
    } catch {
      // Ignore network/logout errors — we clear the local session regardless.
    } finally {
      clear();
      queryClient.clear();
      router.replace("/login");
    }
  }

  return { logout, loading: mutation.isPending };
}
