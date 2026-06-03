import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A soft "screen" frame used to present the product mockups. Gives every
 * visual a consistent premium device-like surface with a warm shadow.
 */
export function Frame({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-line bg-paper shadow-lg",
        className,
      )}
      role="img"
      aria-label={label}
    >
      {/* top chrome bar */}
      <div className="flex items-center gap-1.5 border-b border-line/80 bg-cream/70 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-terracotta/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-saffron/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-sage/60" />
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}
