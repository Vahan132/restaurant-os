import { useTranslations } from "next-intl";

/**
 * Hero composition: a warm "plated" food placeholder with floating product
 * chips layered over it. Photography would drop into the .photo block; until
 * then it reads as an intentional warm gradient scene, not a broken image.
 */
export function HeroVisual() {
  const t = useTranslations("home.visuals.hero");
  return (
    <div className="relative mx-auto aspect-[5/6] w-full max-w-md sm:max-w-lg">
      {/* soft halo */}
      <div className="absolute inset-0 -z-10 rounded-[42px] bg-saffron/15 blur-2xl" />

      {/* main "photo" card */}
      <div className="relative h-full w-full overflow-hidden rounded-[36px] border border-line bg-paper shadow-lg">
        <div
          className="h-full w-full"
          style={{
            background:
              "radial-gradient(120% 90% at 30% 20%, #f6dcc0 0%, #eab784 38%, #c9612f 78%, #a44a22 100%)",
          }}
          role="img"
          aria-label={t("alt")}
        >
          {/* abstract plate */}
          <div className="flex h-full items-center justify-center">
            <div className="relative h-2/3 w-2/3 rounded-full bg-cream/85 shadow-inner">
              <div className="absolute inset-6 rounded-full border border-terracotta/20" />
              <div className="absolute left-1/2 top-1/2 h-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-saffron to-terracotta opacity-90" />
              <div className="absolute right-[26%] top-[30%] h-6 w-6 rounded-full bg-sage/80" />
              <div className="absolute bottom-[30%] left-[30%] h-4 w-10 rounded-full bg-terracotta-ink/70" />
            </div>
          </div>
        </div>
      </div>

      {/* floating order ticket */}
      <div className="absolute -left-4 top-10 w-44 rounded-2xl border border-line bg-paper/95 p-4 shadow-md backdrop-blur-sm animate-subtle-float sm:-left-8">
        <p className="text-2xs font-semibold uppercase tracking-eyebrow text-muted">
          {t("newOrder")} · {t("table", { n: 7 })}
        </p>
        <div className="mt-2 flex flex-col gap-1.5 text-xs text-ink-soft">
          <span>
            <span className="font-semibold text-terracotta-ink">2×</span> Margherita
          </span>
          <span>
            <span className="font-semibold text-terracotta-ink">1×</span> Burrata
          </span>
        </div>
        <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-pill bg-sage-soft px-2 py-0.5 text-2xs font-semibold text-sage-deep">
          <span className="h-1.5 w-1.5 rounded-full bg-sage" /> {t("sentToKitchen")}
        </div>
      </div>

      {/* floating revenue chip */}
      <div
        className="absolute -right-3 bottom-12 w-40 rounded-2xl border border-line bg-paper/95 p-3.5 shadow-md backdrop-blur-sm animate-subtle-float sm:-right-7"
        style={{ animationDelay: "1.4s" }}
      >
        <p className="text-2xs uppercase tracking-eyebrow text-muted">{t("today")}</p>
        <p className="font-display text-2xl text-ink">$4,280</p>
        <div className="mt-1 flex h-6 items-end gap-1">
          {[40, 55, 48, 70, 62, 88].map((h, i) => (
            <span
              key={i}
              className="flex-1 rounded-sm bg-terracotta/40"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
