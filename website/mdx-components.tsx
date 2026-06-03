import type { MDXComponents } from "mdx/types";
import type { ComponentPropsWithoutRef } from "react";
import { Link } from "@/i18n/navigation";
import { Callout, Note } from "@/components/docs/mdx/Callout";
import { Steps, Step } from "@/components/docs/mdx/Steps";

/**
 * Global MDX component map. Styles native markdown elements to the design
 * system and exposes custom doc components (Callout/Note/Steps/Step) so MDX
 * files can use them without importing. Used by every .mdx route.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: (props: ComponentPropsWithoutRef<"h1">) => (
      <h1 className="mb-5 mt-2 font-display text-4xl leading-tight sm:text-5xl" {...props} />
    ),
    h2: (props: ComponentPropsWithoutRef<"h2">) => (
      <h2
        className="mt-14 scroll-mt-28 border-t border-line pt-10 font-display text-2xl sm:text-3xl"
        {...props}
      />
    ),
    h3: (props: ComponentPropsWithoutRef<"h3">) => (
      <h3 className="mt-9 scroll-mt-28 font-display text-xl sm:text-2xl" {...props} />
    ),
    h4: (props: ComponentPropsWithoutRef<"h4">) => (
      <h4 className="mt-7 scroll-mt-28 font-sans text-lg font-semibold text-ink" {...props} />
    ),
    p: (props: ComponentPropsWithoutRef<"p">) => (
      <p className="my-4 text-pretty leading-relaxed text-ink-soft" {...props} />
    ),
    a: ({ href = "#", ...props }: ComponentPropsWithoutRef<"a">) => (
      <Link
        href={href}
        className="font-medium text-terracotta-ink underline decoration-terracotta/30 underline-offset-2 transition-colors hover:decoration-terracotta"
        {...props}
      />
    ),
    ul: (props: ComponentPropsWithoutRef<"ul">) => (
      <ul className="my-4 ml-1 list-none space-y-2.5" {...props} />
    ),
    ol: (props: ComponentPropsWithoutRef<"ol">) => (
      <ol className="my-4 ml-5 list-decimal space-y-2.5 marker:text-terracotta-ink" {...props} />
    ),
    li: (props: ComponentPropsWithoutRef<"li">) => (
      <li
        className="relative pl-6 leading-relaxed text-ink-soft before:absolute before:left-0 before:top-[0.7em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-terracotta/50 [ol>&]:pl-1 [ol>&]:before:hidden"
        {...props}
      />
    ),
    blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => (
      <blockquote
        className="my-6 border-l-2 border-terracotta/40 pl-5 font-display text-xl italic text-ink-soft"
        {...props}
      />
    ),
    hr: () => <hr className="my-10 border-line" />,
    strong: (props: ComponentPropsWithoutRef<"strong">) => (
      <strong className="font-semibold text-ink" {...props} />
    ),
    code: (props: ComponentPropsWithoutRef<"code">) => (
      <code
        className="rounded-md border border-line bg-sand/70 px-1.5 py-0.5 font-mono text-[0.85em] text-terracotta-ink"
        {...props}
      />
    ),
    pre: (props: ComponentPropsWithoutRef<"pre">) => (
      <pre
        className="my-6 overflow-x-auto rounded-xl border border-line bg-ink p-5 text-sm leading-relaxed text-cream [&_code]:border-0 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-cream"
        {...props}
      />
    ),
    table: (props: ComponentPropsWithoutRef<"table">) => (
      <div className="my-6 overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-left text-sm" {...props} />
      </div>
    ),
    th: (props: ComponentPropsWithoutRef<"th">) => (
      <th
        className="border-b border-line bg-sand/60 px-4 py-2.5 font-semibold text-ink"
        {...props}
      />
    ),
    td: (props: ComponentPropsWithoutRef<"td">) => (
      <td className="border-b border-line px-4 py-2.5 text-ink-soft" {...props} />
    ),
    // custom components available in every MDX file
    Callout,
    Note,
    Steps,
    Step,
    ...components,
  };
}
