import { useTranslations } from "next-intl";
import { Frame } from "./Frame";

/* Lightweight, tokenized product mockups for each platform pillar.
   They are decorative (aria-label on the Frame), built from the design system
   so they stay cohesive with the rest of the site. */

export function POSVisual() {
  const t = useTranslations("home.visuals.pos");
  const items = [
    { name: "Margherita", qty: 2, price: "18" },
    { name: "Burrata & peach", qty: 1, price: "14" },
    { name: "Negroni", qty: 2, price: "12" },
  ];
  return (
    <Frame label={t("alt")}>
      <div className="grid grid-cols-5 gap-4 max-[455px]:grid-cols-1">
        <div className="col-span-3 grid grid-cols-2 gap-2.5 max-[455px]:col-span-1">
          {["Pizza", "Antipasti", "Cocktails", "Dolci", "Pasta", "Wine"].map((c, i) => (
            <div
              key={c}
              className={`rounded-lg border border-line px-3 py-3 text-sm font-medium ${
                i === 0 ? "bg-terracotta text-white shadow-sm" : "bg-cream text-ink-soft"
              }`}
            >
              {c}
            </div>
          ))}
        </div>
        <div className="col-span-2 flex flex-col rounded-lg bg-cream p-3 max-[455px]:col-span-1">
          <p className="mb-2 text-2xs font-semibold uppercase tracking-eyebrow text-muted">
            {t("table", { n: 12 })}
          </p>
          <div className="flex flex-col gap-2">
            {items.map((it) => (
              <div key={it.name} className="flex items-center justify-between text-xs">
                <span className="text-ink-soft">
                  <span className="font-semibold text-terracotta-ink">{it.qty}×</span> {it.name}
                </span>
                <span className="tabular-nums text-muted">${it.price}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-sm font-semibold">
            <span>{t("total")}</span>
            <span className="tabular-nums text-terracotta-ink">$74</span>
          </div>
        </div>
      </div>
    </Frame>
  );
}

export function KDSVisual() {
  const t = useTranslations("home.visuals.kds");
  const tickets = [
    { no: "214", where: t("table", { n: 5 }), age: "2:10", tone: "sage", items: ["Carbonara", "House salad"] },
    { no: "215", where: t("takeaway"), age: "4:48", tone: "saffron", items: ["Margherita ×2", "Tiramisu"] },
    { no: "216", where: t("table", { n: 9 }), age: "6:32", tone: "terracotta", items: ["Risotto", "Branzino"] },
  ];
  const ring: Record<string, string> = {
    sage: "border-l-sage",
    saffron: "border-l-saffron",
    terracotta: "border-l-terracotta",
  };
  return (
    <Frame label={t("alt")}>
      <div className="grid grid-cols-3 gap-3">
        {tickets.map((tk) => (
          <div
            key={tk.no}
            className={`rounded-lg border border-line border-l-4 bg-cream p-3 ${ring[tk.tone]}`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-2xs font-semibold text-ink-soft">{`#${tk.no} · ${tk.where}`}</span>
              <span className="rounded-pill bg-paper px-1.5 py-0.5 text-2xs tabular-nums text-muted">
                {tk.age}
              </span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {tk.items.map((it) => (
                <li key={it} className="flex items-center gap-1.5 text-xs text-ink-soft">
                  <span className="h-1.5 w-1.5 rounded-full bg-terracotta/50" />
                  {it}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function TablesVisual() {
  const t = useTranslations("home.visuals.tables");
  // simple floor plan
  const tables = [
    { x: "8%", y: "12%", s: "h-12 w-12", seated: true },
    { x: "42%", y: "10%", s: "h-14 w-14", seated: false },
    { x: "74%", y: "16%", s: "h-12 w-12", seated: true },
    { x: "14%", y: "52%", s: "h-16 w-16", seated: true },
    { x: "48%", y: "54%", s: "h-12 w-12", seated: false },
    { x: "76%", y: "58%", s: "h-14 w-14", seated: true },
  ];
  return (
    <Frame label={t("alt")}>
      <div className="relative h-44 rounded-lg bg-cream">
        {tables.map((t, i) => (
          <div
            key={i}
            className={`absolute flex items-center justify-center rounded-lg text-2xs font-semibold ${t.s} ${
              t.seated
                ? "bg-terracotta-soft text-terracotta-ink ring-1 ring-terracotta/30"
                : "bg-sage-soft text-sage-deep ring-1 ring-sage/30"
            }`}
            style={{ left: t.x, top: t.y }}
          >
            {i + 1}
          </div>
        ))}
        <span className="absolute bottom-2 right-3 text-2xs text-muted">{t("zones")}</span>
      </div>
    </Frame>
  );
}

export function QRVisual() {
  const t = useTranslations("home.visuals.qr");
  return (
    <Frame label={t("alt")}>
      <div className="flex items-center justify-center gap-5 py-2">
        {/* phone */}
        <div className="w-28 shrink-0 rounded-2xl border border-line bg-cream p-2 shadow-sm">
          <div className="mb-1.5 h-1 w-8 rounded-full bg-line" />
          <div className="rounded-lg bg-paper p-2">
            <div className="mb-1.5 h-1.5 w-12 rounded bg-terracotta/60" />
            {[1, 2, 3].map((r) => (
              <div key={r} className="mb-1.5 flex items-center justify-between">
                <div className="h-1.5 w-12 rounded bg-line" />
                <div className="h-1.5 w-4 rounded bg-sage/50" />
              </div>
            ))}
            <div className="mt-2 rounded-md bg-terracotta py-1 text-center text-2xs font-semibold text-white">
              {t("order")}
            </div>
          </div>
        </div>
        {/* QR */}
        <div className="grid h-24 w-24 grid-cols-5 grid-rows-5 gap-1 rounded-lg border border-line bg-paper p-2">
          {Array.from({ length: 25 }).map((_, i) => (
            <span
              key={i}
              className={`rounded-[2px] ${
                [0, 1, 2, 4, 5, 9, 10, 12, 14, 18, 20, 22, 24].includes(i)
                  ? "bg-ink"
                  : "bg-transparent"
              }`}
            />
          ))}
        </div>
      </div>
    </Frame>
  );
}

export function ReportsVisual() {
  const t = useTranslations("home.visuals.reports");
  const bars = [38, 52, 44, 67, 58, 81, 72];
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <Frame label={t("alt")}>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 rounded-lg bg-cream p-3">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-2xs uppercase tracking-eyebrow text-muted">{t("thisWeek")}</p>
              <p className="font-display text-2xl text-ink">$28,940</p>
            </div>
            <span className="rounded-pill bg-sage-soft px-2 py-0.5 text-2xs font-semibold text-sage-deep">
              +12%
            </span>
          </div>
          <div className="flex h-20 items-end justify-between gap-1.5">
            {bars.map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`w-full rounded-t-sm ${i === 5 ? "bg-terracotta" : "bg-terracotta/30"}`}
                  style={{ height: `${h}%` }}
                />
                <span className="text-[9px] text-muted">{days[i]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          {[
            { l: t("covers"), v: "412" },
            { l: t("avgCheck"), v: "$38" },
            { l: t("topItem"), v: "Carbonara" },
          ].map((s) => (
            <div key={s.l} className="rounded-lg bg-cream p-2.5">
              <p className="text-2xs uppercase tracking-eyebrow text-muted">{s.l}</p>
              <p className="text-sm font-semibold text-ink">{s.v}</p>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}
