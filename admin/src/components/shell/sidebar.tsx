'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NAV_ITEMS } from '@/components/shell/nav-config';
import { useAnyPermission } from '@/lib/auth/use-permission';

function NavLink({
  href,
  label,
  nested = false,
}: {
  href: string;
  label: string;
  nested?: boolean;
}) {
  const pathname = usePathname();
  const active = href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`block rounded-md py-2 text-sm font-medium transition-colors ${
        nested ? 'px-3 pl-5' : 'px-3'
      } ${active ? 'bg-brand text-brand-fg' : 'text-gray-700 hover:bg-gray-100'}`}
    >
      {label}
    </Link>
  );
}

function GatedNavLink({ item }: { item: (typeof NAV_ITEMS)[number] }) {
  const t = useTranslations('nav');
  const allowed = useAnyPermission(item.anyOf, item.scope ?? 'branch');
  if (!allowed) return null;

  // Section with sub-navigation (e.g. Inventory).
  if (item.children && item.children.length > 0) {
    return (
      <div className="mt-2 space-y-1">
        <p className="px-3 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
          {t(item.key)}
        </p>
        {item.children.map((child) => (
          <NavLink key={child.href} href={child.href} label={t(child.key)} nested />
        ))}
      </div>
    );
  }

  return <NavLink href={item.href} label={t(item.key)} />;
}

export function Sidebar() {
  const t = useTranslations('common');

  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
      <div className="flex h-14 shrink-0 items-center border-b border-gray-200 px-4 text-lg font-semibold">
        {t('appName')}
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => (
          <GatedNavLink key={item.href} item={item} />
        ))}
      </nav>
    </aside>
  );
}
