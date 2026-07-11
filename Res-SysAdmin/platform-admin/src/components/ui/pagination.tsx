"use client";

import { Button } from "@/components/ui/primitives";
import type { Pagination as PaginationMeta } from "@/lib/format";

/**
 * Pagination control. Works with server pagination metadata when present,
 * and degrades gracefully (hasNext inferred from page size) when the API
 * returns a bare array without totals.
 */
export function Pagination({
  page,
  pageSize,
  itemCount,
  meta,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  itemCount: number;
  meta?: PaginationMeta;
  onPageChange: (page: number) => void;
}) {
  const totalPages = meta?.totalPages;
  const total = meta?.total;
  const hasPrev = page > 1;
  const hasNext = totalPages ? page < totalPages : itemCount >= pageSize;

  if (!hasPrev && !hasNext) return null;

  return (
    <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
      <span>
        Page {page}
        {totalPages ? ` of ${totalPages}` : ""}
        {typeof total === "number" ? ` · ${total} total` : ""}
      </span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasPrev}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasNext}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
