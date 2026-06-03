'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NAV_ITEMS } from '@/components/shell/nav-config';
import { useAnyPermission } from '@/lib/auth/use-permission';

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-brand text-brand-fg'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      {label}
    </Link>
  );
}

function GatedNavLink({ item }: { item: (typeof NAV_ITEMS)[number] }) {
  const t = useTranslations('nav');
  const allowed = useAnyPermission(item.anyOf);
  if (!allowed) return null;
  return <NavLink href={item.href} label={t(item.key)} />;
}

export function Sidebar() {
  const t = useTranslations('common');

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
      <div className="flex h-14 items-center border-b border-gray-200 px-4 text-lg font-semibold">
        {t('appName')}
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => (
          <GatedNavLink key={item.href} item={item} />
        ))}
      </nav>
    </aside>
  );
}
