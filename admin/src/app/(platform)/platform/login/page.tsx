import { useTranslations } from 'next-intl';

import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { PlatformLoginForm } from '@/components/platform/platform-login-form';
import { RedirectIfPlatformAuthed } from '@/components/platform/redirect-if-platform-authed';

export default function PlatformLoginPage() {
  const t = useTranslations('platformAuth');

  return (
    <RedirectIfPlatformAuthed>
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm space-y-6 rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">{t('title')}</span>
            <LanguageSwitcher />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-gray-900">{t('loginTitle')}</h1>
            <p className="text-sm text-gray-500">{t('loginSubtitle')}</p>
          </div>
          <PlatformLoginForm />
        </div>
      </div>
    </RedirectIfPlatformAuthed>
  );
}
