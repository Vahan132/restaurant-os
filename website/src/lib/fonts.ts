import { Fraunces, Hanken_Grotesk } from "next/font/google";

/**
 * Display face — Fraunces.
 * A warm, characterful "old-style" serif with soft, slightly wonky optical
 * details. It gives headlines an editorial, appetizing personality without
 * tipping into formality. Used only for headings + hero type.
 */
export const fontDisplay = Fraunces({
  subsets: ["latin"],
  display: "swap",
  // Variable font: omitting `weight` includes the full wght axis range, so the
  // 480 display weight used in CSS resolves smoothly. Fraunces' optical-size
  // axis is applied automatically.
  variable: "--font-display",
});

/**
 * Body / UI face — Hanken Grotesk.
 * A clean, slightly humanist neutral sans with a warm tone that sits
 * comfortably beneath Fraunces. Handles all body copy, navigation and UI.
 */
export const fontSans = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});
