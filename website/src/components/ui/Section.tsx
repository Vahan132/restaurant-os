import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Container } from "./Container";
import { Reveal } from "./Reveal";

type SectionProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  /** Background band. */
  tone?: "cream" | "sand" | "paper";
  size?: "default" | "wide";
};

const tones = {
  cream: "",
  sand: "bg-sand",
  paper: "bg-paper",
};

export function Section({ children, className, id, tone = "cream", size = "default" }: SectionProps) {
  return (
    <section id={id} className={cn("layer-up py-20 sm:py-28", tones[tone], className)}>
      <Container size={size}>{children}</Container>
    </section>
  );
}

type SectionHeadingProps = {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  align?: "left" | "center";
  className?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = "center",
  className,
}: SectionHeadingProps) {
  return (
    <Reveal
      className={cn(
        "flex flex-col gap-4",
        align === "center" ? "mx-auto max-w-2xl items-center text-center" : "max-w-2xl",
        className,
      )}
    >
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <h2 className="text-3xl text-balance sm:text-4xl">{title}</h2>
      {intro ? <p className="text-pretty text-lg text-muted">{intro}</p> : null}
    </Reveal>
  );
}
