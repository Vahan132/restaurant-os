"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { useLogin } from "@/hooks/use-auth";
import { Button, Card, Field, Input } from "@/components/ui/primitives";

export default function LoginPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const { login, loading, error } = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (accessToken) router.replace("/");
  }, [accessToken, router]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void login(email, password);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-sm">
        <div className="space-y-1 border-b border-gray-100 px-6 py-5">
          <h1 className="text-lg font-semibold text-gray-900">Platform Admin</h1>
          <p className="text-sm text-gray-500">Sign in with your platform account.</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 px-6 py-5">
          <Field label="Email" htmlFor="email" required>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Password" htmlFor="password" required>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          <Button type="submit" loading={loading} className="w-full">
            Sign in
          </Button>
        </form>
      </Card>
    </div>
  );
}
