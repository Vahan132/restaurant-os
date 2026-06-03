import { useTranslations } from 'next-intl';

import { LoginForm } from '@/components/auth/login-form';
import { RedirectIfAuthed } from '@/components/auth/redirect-if-authed';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';

export default function LoginPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');

  return (
    <RedirectIfAuthed>
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm space-y-6 rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">{tc('appName')}</span>
            <LanguageSwitcher />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-gray-900">{t('loginTitle')}</h1>
            <p className="text-sm text-gray-500">{t('loginSubtitle')}</p>
          </div>
          <LoginForm />
        </div>
      </div>
    </RedirectIfAuthed>
  );
}
