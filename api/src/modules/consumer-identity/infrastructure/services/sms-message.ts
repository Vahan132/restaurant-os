export type SmsLocale = 'hy' | 'ru' | 'en';

const TEMPLATES: Record<SmsLocale, (code: string) => string> = {
  hy: (code) => `Ձեր հաստատման կոդը՝ ${code}։ Մի կիսվեք այն ոչ ոքի հետ։`,
  ru: (code) => `Ваш код подтверждения: ${code}. Никому его не сообщайте.`,
  en: (code) => `Your verification code is ${code}. Do not share it with anyone.`,
};

/**
 * Build the localized OTP SMS body. There is no central i18n service in the
 * backend (per CX-1), so OTP text uses this small per-locale template map.
 * Falls back to hy (the platform default) for unknown locales.
 */
export function otpMessage(code: string, locale: string | null | undefined): string {
  const key = (locale ?? 'hy').toLowerCase() as SmsLocale;
  return (TEMPLATES[key] ?? TEMPLATES.hy)(code);
}
