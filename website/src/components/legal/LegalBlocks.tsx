import { Callout } from "@/components/docs/mdx/Callout";
import type { LegalBlock, LegalSection } from "@/config/legal";
import { renderInline } from "./inline";

/** Renders one content block in W1 long-form typography. */
function Block({ block, idx }: { block: LegalBlock; idx: number }) {
  switch (block.type) {
    case "p":
      return (
        <p className="my-4 text-pretty leading-relaxed text-ink-soft">
          {renderInline(block.text, `p${idx}`)}
        </p>
      );
    case "sub":
      return (
        <h3 className="mt-8 scroll-mt-28 font-sans text-lg font-semibold text-ink">
          {renderInline(block.text, `s${idx}`)}
        </h3>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag
          className={
            block.ordered
              ? "my-4 ml-5 list-decimal space-y-2.5 marker:text-terracotta-ink"
              : "my-4 ml-1 list-none space-y-2.5"
          }
        >
          {block.items.map((item, i) => (
            <li
              key={i}
              className={
                block.ordered
                  ? "pl-1 leading-relaxed text-ink-soft"
                  : "relative pl-6 leading-relaxed text-ink-soft before:absolute before:left-0 before:top-[0.7em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-terracotta/50"
              }
            >
              {renderInline(item, `l${idx}-${i}`)}
            </li>
          ))}
        </Tag>
      );
    }
    case "callout":
      return (
        <Callout tone={block.tone ?? "note"} title={block.title}>
          <p>{renderInline(block.text, `c${idx}`)}</p>
        </Callout>
      );
  }
}

/** Renders one anchored section (heading + blocks). */
export function LegalSectionView({ section }: { section: LegalSection }) {
  return (
    <section
      id={section.id}
      aria-labelledby={`${section.id}-h`}
      className="mt-12 scroll-mt-28 border-t border-line pt-10 first:mt-0 first:border-t-0 first:pt-0"
    >
      <h2 id={`${section.id}-h`} className="font-display text-2xl sm:text-3xl">
        {renderInline(section.title, `h-${section.id}`)}
      </h2>
      {section.blocks.map((block, i) => (
        <Block key={i} block={block} idx={i} />
      ))}
    </section>
  );
}
