import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";

/** Centered, warm card used by the login / password-reset screens. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Container className="flex min-h-[78vh] items-center justify-center py-16">
      <div className="w-full max-w-md">
        <div className="wash-warm relative overflow-hidden rounded-2xl border border-line bg-paper p-8 shadow-md sm:p-10">
          <div className="flex flex-col gap-2 text-center">
            <h1 className="font-display text-3xl">{title}</h1>
            {subtitle ? <p className="text-pretty text-muted">{subtitle}</p> : null}
          </div>
          <div className="mt-8">{children}</div>
        </div>
        {footer ? <div className="mt-6 text-center text-sm text-muted">{footer}</div> : null}
      </div>
    </Container>
  );
}
