"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Understated entrance reveal — a short fade + rise.
 *
 * Implemented with CSS animation rather than a JS animation library so it is:
 *  - no-JS safe: without JavaScript the content renders fully visible
 *    (`data-anim` is never set, so no hiding rule applies);
 *  - reduced-motion safe: globals.css collapses animation durations to ~0;
 *  - reliable: the keyframe runs on load for `mount`, or when scrolled into
 *    view for `inView` (via IntersectionObserver).
 *
 * `delay` (in steps) staggers siblings. Use `trigger="mount"` for
 * above-the-fold content so it animates immediately instead of waiting on the
 * scroll observer.
 */
type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li" | "span";
  once?: boolean;
  trigger?: "inView" | "mount";
};

export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
  once = true,
  trigger = "inView",
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  // mount → animate right away. inView → stay undefined (visible) on the
  // server, then JS hides it and reveals on scroll.
  const [anim, setAnim] = useState<"show" | "hidden" | undefined>(
    trigger === "mount" ? "show" : undefined,
  );

  useEffect(() => {
    if (trigger === "mount") return;
    const el = ref.current;
    if (!el) return;
    setAnim("hidden");

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setAnim("show");
            if (once) io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -80px 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [trigger, once]);

  return (
    <Tag
      ref={ref as never}
      className={cn("reveal", className)}
      data-anim={anim}
      style={{ "--reveal-delay": `${delay * 90}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
