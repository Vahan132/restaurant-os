/**
 * Global site metadata. Centralized so SEO, header, and footer stay in sync.
 */
export const site = {
  name: "Restaurant OS",
  tagline: "The operating system for modern restaurants.",
  description:
    "Restaurant OS unifies point-of-sale, kitchen display, tables & reservations, QR ordering and live reporting in one warm, fast platform — so your team can focus on the food.",
  url: "https://restaurantos.example.com",
  // CTA destinations. Auth + account live in a later milestone (W2);
  // these point at placeholder routes for now.
  routes: {
    login: "/login",
    signup: "/signup",
    docs: "/docs",
  },
  social: {
    twitter: "@restaurantos",
  },
} as const;

export type Site = typeof site;
