'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { isNotFound, type ApiError } from '@/api/mutator';
import {
  usePublicStorefrontControllerBranchMenu,
  usePublicStorefrontControllerBranches,
  usePublicStorefrontControllerRestaurant,
  usePublicStorefrontControllerTable,
} from '@/api/generated/public/public';
import type {
  PublicBranchResponse,
  PublicMenuItemResponse,
  PublicMenuResponse,
  PublicRestaurantResponse,
  PublicTableResponse,
} from '@/api/generated/model';
import { resolveBranchSlug, resolveSlug, resolveTableQr, withBranchParam } from '@/lib/tenant';

import BrandingHeader from './BrandingHeader';
import CartBar from './cart/CartBar';
import CartView from './cart/CartView';
import { useCart } from './cart/CartProvider';
import OrderStatusScreen from './cart/OrderStatusScreen';
import CategoryNav from './CategoryNav';
import ItemCard from './ItemCard';
import ItemDetailSheet from './ItemDetailSheet';
import LocationPicker from './LocationPicker';
import SearchBox from './SearchBox';
import { MenuSkeleton } from './Skeletons';
import { EmptyMenu, GenericError, MenuUnavailable } from './StateScreens';

export default function MenuView() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const tSearch = useTranslations('search');
  const tGate = useTranslations('gating');
  const tLoc = useTranslations('location');
  const { addLine } = useCart();
  const restaurantSlug = resolveSlug();

  // Resolve the table (?qr=) and any pre-chosen branch (?branch=) after mount,
  // to avoid an SSR/client hydration mismatch on the query string.
  const [qr, setQr] = useState<string | null>(null);
  const [qrReady, setQrReady] = useState(false);
  const [pickedBranch, setPickedBranch] = useState<string | null>(null);
  useEffect(() => {
    setQr(resolveTableQr());
    setPickedBranch(resolveBranchSlug());
    setQrReady(true);
  }, []);

  const hasTable = qrReady && !!qr;
  const noTable = qrReady && !qr;

  const restaurantQ = usePublicStorefrontControllerRestaurant<
    PublicRestaurantResponse,
    ApiError
  >();
  // Dine-in: the scanned QR token resolves to its table AND its branch (BR-9:
  // PublicTableResponse carries branchSlug/branchName). Never ask the customer
  // to pick — the table implies the branch.
  const tableQ = usePublicStorefrontControllerTable<PublicTableResponse, ApiError>(
    { qr: qr ?? '' },
    { query: { enabled: hasTable } },
  );
  // No table: load the locations so the customer can pick one (and so we can
  // show the chosen branch's name). The endpoint returns a bare branch array.
  const branchesQ = usePublicStorefrontControllerBranches<PublicBranchResponse[], ApiError>(
    restaurantSlug,
    { query: { enabled: noTable && !!restaurantSlug } },
  );

  const tableBranchSlug = hasTable ? (tableQ.data?.branchSlug ?? null) : null;
  const pickedBranchSummary = useMemo(
    () => branchesQ.data?.find((b) => b.slug === pickedBranch) ?? null,
    [branchesQ.data, pickedBranch],
  );

  // The branch we render the menu for: from the table (dine-in) or the picker.
  const branchSlug = hasTable ? tableBranchSlug : (pickedBranchSummary?.slug ?? null);
  // Branch/location label for clarity: the table carries its branch name
  // (dine-in); otherwise the picked location's name.
  const branchName = hasTable
    ? (tableQ.data?.branchName ?? null)
    : (pickedBranchSummary?.name ?? null);

  const menuQ = usePublicStorefrontControllerBranchMenu<PublicMenuResponse, ApiError>(
    restaurantSlug,
    branchSlug ?? '',
    { query: { enabled: !!restaurantSlug && !!branchSlug } },
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

  function chooseBranch(slug: string) {
    setPickedBranch(slug);
    router.replace(withBranchParam(pathname, slug));
  }

  function changeLocation() {
    setPickedBranch(null);
    const params = new URLSearchParams(window.location.search);
    params.delete('branch');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  // --- Top-level states -----------------------------------------------------
  if (isNotFound(restaurantQ.error)) return <MenuUnavailable />;
  if (restaurantQ.isError) return <GenericError />;
  if (!qrReady || restaurantQ.isLoading || !restaurantQ.data) return <MenuSkeleton />;

  const restaurant = restaurantQ.data;
  const currency = restaurant.currency;

  // Dine-in: wait for the table to resolve its branch; a bad QR => unavailable.
  if (hasTable) {
    if (isNotFound(tableQ.error)) return <MenuUnavailable />;
    if (tableQ.isError) return <GenericError />;
    if (tableQ.isLoading || !tableQ.data) return <MenuSkeleton />;
  }

  // No table: pick a location first.
  if (noTable) {
    if (isNotFound(branchesQ.error)) return <MenuUnavailable />;
    if (branchesQ.isError) return <GenericError />;
    if (branchesQ.isLoading || !branchesQ.data) return <MenuSkeleton />;
    // No branch chosen yet (or a stale ?branch= that no longer exists).
    if (!pickedBranchSummary) {
      return (
        <div className="min-h-screen pb-12">
          <BrandingHeader name={restaurant.name} logoUrl={restaurant.logoUrl} />
          <LocationPicker
            branches={branchesQ.data}
            title={tLoc('menuTitle')}
            subtitle={tLoc('menuSubtitle')}
            onSelect={chooseBranch}
          />
        </div>
      );
    }
  }

  if (isNotFound(menuQ.error)) return <MenuUnavailable />;
  if (menuQ.isError) return <GenericError />;
  if (menuQ.isLoading || !menuQ.data) return <MenuSkeleton />;

  const tableName = hasTable ? (tableQ.data?.name ?? null) : null;

  // Ordering gate: orderingEnabled AND a table resolved from ?qr=.
  const tableResolved = hasTable && !!tableQ.data;
  const orderingAvailable = restaurant.orderingEnabled && tableResolved;
  // Inline note only when ordering is enabled but no table is scanned.
  const showScanNote = restaurant.orderingEnabled && noTable;

  // The order status screen takes over the whole view while active.
  if (activeOrderId) {
    return (
      <OrderStatusScreen orderId={activeOrderId} onBackToMenu={() => setActiveOrderId(null)} />
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <BrandingHeader
        name={restaurant.name}
        logoUrl={restaurant.logoUrl}
        tableName={tableName}
        locationName={branchName}
      />

      <div className="mx-auto max-w-2xl">
        <SearchBox value={query} onChange={setQuery} />
        {showScanNote ? (
          <p className="mx-4 mb-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {tGate('scanToOrder')}
          </p>
        ) : null}
        {noTable ? (
          <button
            type="button"
            onClick={changeLocation}
            className="mx-4 mb-1 text-xs font-medium text-brand-accent underline-offset-2 hover:underline"
          >
            {tLoc('change')}
          </button>
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
