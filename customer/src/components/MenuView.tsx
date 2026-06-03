'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';

import { isNotFound, type ApiError } from '@/api/mutator';
import {
  usePublicStorefrontControllerMenu,
  usePublicStorefrontControllerRestaurant,
  usePublicStorefrontControllerTable,
} from '@/api/generated/public/public';
import type {
  PublicMenuItemResponse,
  PublicMenuResponse,
  PublicRestaurantResponse,
  PublicTableResponse,
} from '@/api/generated/model';
import { resolveTableQr } from '@/lib/tenant';

import BrandingHeader from './BrandingHeader';
import CartBar from './cart/CartBar';
import CartView from './cart/CartView';
import { useCart } from './cart/CartProvider';
import OrderStatusScreen from './cart/OrderStatusScreen';
import CategoryNav from './CategoryNav';
import ItemCard from './ItemCard';
import ItemDetailSheet from './ItemDetailSheet';
import SearchBox from './SearchBox';
import { MenuSkeleton } from './Skeletons';
import { EmptyMenu, GenericError, MenuUnavailable } from './StateScreens';

export default function MenuView() {
  const locale = useLocale();
  const tSearch = useTranslations('search');
  const tGate = useTranslations('gating');
  const { addLine } = useCart();

  // Resolve the table from ?qr= after mount (avoids SSR/client hydration mismatch).
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => setQr(resolveTableQr()), []);

  const restaurantQ = usePublicStorefrontControllerRestaurant<
    PublicRestaurantResponse,
    ApiError
  >();
  const menuQ = usePublicStorefrontControllerMenu<PublicMenuResponse, ApiError>();
  const tableQ = usePublicStorefrontControllerTable<PublicTableResponse, ApiError>(
    { qr: qr ?? '' },
    { query: { enabled: !!qr } },
  );

  const [query, setQuery] = useState('');
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const categories = useMemo(() => menuQ.data?.categories ?? [], [menuQ.data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map((c) => ({ ...c, items: c.items.filter((i) => i.name.toLowerCase().includes(q)) }))
      .filter((c) => c.items.length > 0);
  }, [categories, query]);

  const allItems = useMemo<PublicMenuItemResponse[]>(
    () => categories.flatMap((c) => c.items),
    [categories],
  );
  const openItem = allItems.find((i) => i.id === openItemId) ?? null;

  useEffect(() => {
    if (query || filtered.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const id = visible[0]?.target.getAttribute('data-category-id');
        if (id) setActiveCategory(id);
      },
      { rootMargin: '-96px 0px -65% 0px', threshold: 0 },
    );
    filtered.forEach((c) => {
      const el = sectionRefs.current[c.id];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [filtered, query]);

  function scrollToCategory(id: string) {
    setActiveCategory(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // --- Top-level states -----------------------------------------------------
  if (isNotFound(restaurantQ.error) || isNotFound(menuQ.error)) return <MenuUnavailable />;
  if (restaurantQ.isError || menuQ.isError) return <GenericError />;
  if (restaurantQ.isLoading || menuQ.isLoading || !restaurantQ.data) return <MenuSkeleton />;

  const restaurant = restaurantQ.data;
  const currency = restaurant.currency;
  const tableName = qr ? (tableQ.data?.name ?? null) : null;

  // Ordering gate: orderingEnabled AND a table resolved from ?qr=.
  const tableResolved = !!qr && !!tableQ.data;
  const orderingAvailable = restaurant.orderingEnabled && tableResolved;
  // Inline note only when ordering is enabled but no table is scanned.
  const showScanNote = restaurant.orderingEnabled && !tableResolved && !tableQ.isLoading;

  // The order status screen takes over the whole view while active.
  if (activeOrderId) {
    return (
      <OrderStatusScreen orderId={activeOrderId} onBackToMenu={() => setActiveOrderId(null)} />
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <BrandingHeader name={restaurant.name} logoUrl={restaurant.logoUrl} tableName={tableName} />

      <div className="mx-auto max-w-2xl">
        <SearchBox value={query} onChange={setQuery} />
        {showScanNote ? (
          <p className="mx-4 mb-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {tGate('scanToOrder')}
          </p>
        ) : null}
      </div>

      {!query ? (
        <CategoryNav
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          activeId={activeCategory}
          onSelect={scrollToCategory}
        />
      ) : null}

      <main className="mx-auto max-w-2xl px-4 pt-2">
        {categories.length === 0 ? (
          <EmptyMenu />
        ) : filtered.length === 0 ? (
          <p className="px-1 py-16 text-center text-sm text-gray-500">
            {tSearch('noResults', { query })}
          </p>
        ) : (
          filtered.map((category) => (
            <section
              key={category.id}
              data-category-id={category.id}
              ref={(el) => {
                sectionRefs.current[category.id] = el;
              }}
              className="scroll-mt-28 py-3"
            >
              <h2 className="mb-2 px-1 text-base font-semibold text-gray-900">{category.name}</h2>
              {category.description ? (
                <p className="mb-2 px-1 text-xs text-gray-500">{category.description}</p>
              ) : null}
              <div className="space-y-2.5">
                {category.items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    currency={currency}
                    locale={locale}
                    onOpen={setOpenItemId}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      <ItemDetailSheet
        item={openItem}
        currency={currency}
        locale={locale}
        orderingAvailable={orderingAvailable}
        onAddToCart={addLine}
        onClose={() => setOpenItemId(null)}
      />

      {orderingAvailable ? (
        <CartBar currency={currency} locale={locale} onOpen={() => setCartOpen(true)} />
      ) : null}

      {orderingAvailable && cartOpen ? (
        <CartView
          qr={qr as string}
          currency={currency}
          locale={locale}
          onClose={() => setCartOpen(false)}
          onPlaced={(orderId) => {
            setCartOpen(false);
            setActiveOrderId(orderId);
          }}
        />
      ) : null}
    </div>
  );
}
