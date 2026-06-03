export function MenuSkeleton() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse px-4 py-4" aria-hidden>
      <div className="mb-4 h-7 w-40 rounded bg-gray-200" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3 rounded-xl border border-gray-100 p-2.5">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded bg-gray-200" />
              <div className="h-3 w-full rounded bg-gray-100" />
              <div className="h-4 w-16 rounded bg-gray-200" />
            </div>
            <div className="h-20 w-20 shrink-0 rounded-lg bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
