import { cn } from "@/lib/cn";
import type { ElementType, ReactNode } from "react";

type ContainerProps = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  size?: "default" | "wide" | "prose";
};

const sizes = {
  default: "max-w-container",
  wide: "max-w-wide",
  prose: "max-w-prose",
};

export function Container({
  children,
  className,
  as: Tag = "div",
  size = "default",
}: ContainerProps) {
  return (
    <Tag className={cn("mx-auto w-full px-6 sm:px-8", sizes[size], className)}>{children}</Tag>
  );
}
