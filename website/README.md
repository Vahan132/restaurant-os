# Restaurant OS — Marketing & Docs site

The public marketing + documentation website for **Restaurant OS**, a (fictional) operating
system for restaurants. Built with the **App Router**, **TypeScript (strict)**, **Tailwind CSS**,
and **MDX** for the docs.

> Scope (W1): design system + static marketing/docs only. Auth, onboarding and account pages
> arrive in W2 — their CTAs currently link to `/login` and `/signup` placeholders. There are no
> backend calls; plans and docs content are local config + MDX, structured so they can later read
> live data.

## Scripts

```bash
npm run dev        # start the dev server
npm run build      # production build
npm run start      # serve the production build
npm run lint       # ESLint (next/core-web-vitals + prettier)
npm run typecheck  # tsc --noEmit
npm run format     # prettier --write
```

## Design system

This site is built from a documented token system — not a default template.

- **Tokens (single source of truth):** [`src/styles/tokens.css`](src/styles/tokens.css) — color
  (as RGB channels for Tailwind alpha support), radii, shadows, motion, layout.
- **Token → utility mapping:** [`tailwind.config.ts`](tailwind.config.ts) maps each token onto
  Tailwind's namespace (`bg-cream`, `text-terracotta-ink`, `rounded-xl`, `shadow-glow`, …).
- **Base layer + helpers:** [`src/app/globals.css`](src/app/globals.css) — typography defaults,
  paper-grain background, `.eyebrow`, `.wash-warm`, reduced-motion handling, the `.reveal`
  entrance animation.
- **Fonts:** [`src/lib/fonts.ts`](src/lib/fonts.ts) — Fraunces (display) + Hanken Grotesk (body).

### The look

Warm, food-forward, premium-minimal. Cream/linen surfaces, warm near-black ink, a terracotta +
saffron accent with a sage secondary, an elegant serif display paired with a clean neutral sans,
generous whitespace, soft rounded corners and warm low-contrast shadows.

### Accessibility

- AA contrast (separate `terracotta` for fills vs. `terracotta-ink` for text-on-light).
- Semantic HTML, labelled controls, visible focus rings, a skip link.
- Keyboard-friendly nav, native `<details>` FAQ accordion.
- `prefers-reduced-motion` collapses all motion; entrance reveals are no-JS safe (content is
  visible without JavaScript).

## Content & config

- **Plans:** [`src/config/plans.ts`](src/config/plans.ts) — modeled to mirror a future
  `GET /v1/plans` response (minor-unit amounts + currency) so it can swap to a fetch later.
- **Navigation:** [`src/config/nav.ts`](src/config/nav.ts) — header, footer and docs nav.
- **Site / SEO:** [`src/config/site.ts`](src/config/site.ts), plus per-page `metadata`,
  `sitemap.ts`, `robots.ts`.
- **i18n:** [`src/config/i18n.ts`](src/config/i18n.ts) — `en` default, structured for `hy`/`ru`
  (content stays English for now); language switcher stub in the footer.

## Docs

MDX pages under `src/app/docs/*/page.mdx`, rendered through a sidebar + content + on-page TOC
layout. Custom MDX components (`Callout`, `Note`, `Steps`/`Step`) and styled native elements live
in [`mdx-components.tsx`](mdx-components.tsx). The sidebar has a client-side search filter; the TOC
is generated from heading IDs (rehype-slug).
