'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { BranchSwitcher } from '@/components/shell/branch-switcher';
import { logout } from '@/lib/auth/auth-service';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';
import { useAuthStore } from '@/stores/auth';

export function Topbar() {
  const t = useTranslations('auth');
  const tt = useTranslations('topbar');
  const tc = useTranslations('common');
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: restaurant } = useRestaurant();
  const [menuOpen, setMenuOpen] = useState(false);

  const onLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4">
      <div className="truncate text-sm font-medium text-gray-900">
        {restaurant?.name ?? tc('appName')}
      </div>

      <div className="flex items-center gap-4">
        <BranchSwitcher />
        <LanguageSwitcher />

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-gray-100"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-fg">
              {(user?.fullName ?? '?').charAt(0).toUpperCase()}
            </span>
            <span className="hidden max-w-[12rem] truncate sm:block">
              {user?.fullName ?? tt('userMenu')}
            </span>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-1 w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                onClick={onLogout}
                className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                {t('logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
