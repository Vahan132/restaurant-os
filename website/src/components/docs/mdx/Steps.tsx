import type { ReactNode } from "react";

/**
 * A numbered steps list for procedures. Uses a CSS counter so steps stay
 * correctly numbered regardless of how MDX renders them. Usage:
 *   <Steps>
 *     <Step title="Do this">…</Step>
 *     <Step title="Then that">…</Step>
 *   </Steps>
 */
export function Steps({ children }: { children: ReactNode }) {
  return (
    <ol className="my-6 ml-0 list-none space-y-6 [counter-reset:step]">{children}</ol>
  );
}

export function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="relative pl-12 [counter-increment:step]">
      <span
        aria-hidden
        className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-paper font-display text-sm text-terracotta-ink shadow-xs before:content-[counter(step)]"
      />
      <p className="mb-1 mt-1 font-semibold text-ink">{title}</p>
      <div className="text-sm leading-relaxed text-muted [&>:first-child]:mt-0 [&>:last-child]:mb-0">
        {children}
      </div>
    </li>
  );
}
