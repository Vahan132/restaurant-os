"use client";

import type { ComponentProps, MouseEvent } from "react";
import { Link, usePathname } from "@/i18n/navigation";

export function HashLink({ href, onClick, ...rest }: ComponentProps<typeof Link>) {
  const pathname = usePathname();

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented || typeof href !== "string") return;

    const hashAt = href.indexOf("#");
    if (hashAt === -1) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const targetPath = href.slice(0, hashAt) || "/";
    if (pathname !== targetPath) return;

    e.preventDefault();
    const id = href.slice(hashAt + 1);
    document.getElementById(id)?.scrollIntoView();
  }

  return <Link href={href} onClick={handleClick} {...rest} />;
}
