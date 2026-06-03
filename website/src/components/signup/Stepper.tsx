import { cn } from "@/lib/cn";

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center justify-center gap-2 sm:gap-3">
      {steps.map((label, i) => {
        const state = i < current ? "done" : i === current ? "active" : "todo";
        return (
          <li key={label} className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                  state === "done" && "border-terracotta bg-terracotta text-white",
                  state === "active" && "border-terracotta bg-terracotta-soft text-terracotta-ink",
                  state === "todo" && "border-line bg-paper text-muted",
                )}
              >
                {state === "done" ? (
                  <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" fill="none" aria-hidden>
                    <path
                      d="M2.5 6.2 5 8.5l4.5-5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={cn(
                  "hidden text-sm font-medium sm:inline",
                  state === "todo" ? "text-muted" : "text-ink",
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <span
                className={cn(
                  "h-px w-6 sm:w-10",
                  i < current ? "bg-terracotta/50" : "bg-line",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
