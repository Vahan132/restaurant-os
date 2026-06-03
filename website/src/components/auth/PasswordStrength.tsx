"use client";

import { useTranslations } from "next-intl";
import { scorePassword } from "@/lib/password";
import { cn } from "@/lib/cn";

const barColor = ["bg-line", "bg-terracotta", "bg-saffron", "bg-sage", "bg-sage-deep"];

export function PasswordStrength({ value }: { value: string }) {
  const t = useTranslations("auth.passwordStrength");
  if (!value) return null;
  const { score } = scorePassword(value);
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-pill transition-colors",
              i < score ? barColor[score] : "bg-line",
            )}
          />
        ))}
      </div>
      <span className="w-16 text-right text-xs font-medium text-muted">{t(String(score))}</span>
    </div>
  );
}
