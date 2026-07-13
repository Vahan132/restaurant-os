/**
 * LOCALE-2A — a trilingual text value: the hy/ru/en translations of a primary
 * string. Each is nullable (null = not translated → callers fall back to the
 * primary via LOCALE-2B's `resolveI18n`). Structurally matches the consumer
 * `I18nTextResponse`, but lives in `shared` so the domain doesn't import a DTO.
 */
export interface I18nText {
  hy: string | null;
  ru: string | null;
  en: string | null;
}
