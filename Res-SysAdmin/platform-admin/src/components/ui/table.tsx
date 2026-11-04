"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/primitives";

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-gray-50">{children}</thead>;
}

export function TH({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={[
        "px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-gray-100 bg-white">{children}</tbody>;
}

export function TR({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={onClick ? "cursor-pointer hover:bg-gray-50" : undefined}
    >
      {children}
    </tr>
  );
}

export function TD({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <td className={["px-4 py-2.5 text-gray-700", className].filter(Boolean).join(" ")}>
      {children}
    </td>
  );
}

/** Skeleton rows for loading tables. */
export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <TBody>
      {Array.from({ length: rows }).map((_, r) => (
        <TR key={r}>
          {Array.from({ length: cols }).map((__, c) => (
            <TD key={c}>
              <Skeleton className="h-4 w-full max-w-[160px]" />
            </TD>
          ))}
        </TR>
      ))}
    </TBody>
  );
}
