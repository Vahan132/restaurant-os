import { setRequestLocale } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { DocsTOC } from "@/components/docs/DocsTOC";
import { DocsPager } from "@/components/docs/DocsPager";
import { DocsMobileNav } from "@/components/docs/DocsMobileNav";

export default async function DocsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Container size="wide" className="layer-up py-10 sm:py-12">
      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[16rem_minmax(0,1fr)_14rem] xl:gap-14">
        {/* Left: section nav */}
        <aside className="hidden lg:block">
          <div className="sticky top-[calc(var(--header-h)+1.5rem)] max-h-[calc(100vh-var(--header-h)-3rem)] overflow-y-auto pb-10">
            <DocsSidebar />
          </div>
        </aside>

        {/* Mobile nav */}
        <div className="mb-8 lg:hidden">
          <DocsMobileNav />
        </div>

        {/* Center: content */}
        <article id="docs-article" className="min-w-0 max-w-3xl text-[1.0625rem]">
          {children}
          <DocsPager />
        </article>

        {/* Right: on-page TOC */}
        <aside className="hidden xl:block">
          <div className="sticky top-[calc(var(--header-h)+1.5rem)]">
            <DocsTOC />
          </div>
        </aside>
      </div>
    </Container>
  );
}
