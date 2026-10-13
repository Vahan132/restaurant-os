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
import { hasSessionToken } from '@/lib/session';

import BrandingHeader from './BrandingHeader';
import CartBar from './cart/CartBar';
import CartView from './cart/CartView';
import CheckoutView from './cart/CheckoutView';
import ReceiptView from './cart/ReceiptView';
import SessionOrders from './cart/SessionOrders';
import { useCart } from './cart/CartProvider';
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
  const tStatus = useTranslations('liveStatus');
  const { addLine } = useCart();
  const restaurantSlug = resolveSlug();

  // Resolve the table (?qr=) and any pre-chosen branch (?branch=) after mount,
  // to avoid an SSR/client hydration mismatch on the query string.
  const [qr, setQr] = useState<string | null>(null);
  const [qrReady, setQrReady] = useState(false);
  const [pickedBranch, setPickedBranch] = useState<string | null>(null);
  // Whether this table already has a persisted session token (a prior order on
  // this device) — drives the "view my orders" reattach affordance.
  const [hasSession, setHasSession] = useState(false);
  useEffect(() => {
    setQr(resolveTableQr());
    setPickedBranch(resolveBranchSlug());
    setHasSession(hasSessionToken());
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
  // Prepayment flow stage. `menu` is the browse surface; the others are
  // full-screen takeovers. `receipt` carries the just-paid order id.
  const [stage, setStage] = useState<
    | { name: 'menu' }
    | { name: 'cart' }
    | { name: 'checkout' }
    | { name: 'receipt'; orderId: string }
    | { name: 'status' }
  >({ name: 'menu' });
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

  // Prepayment full-screen takeovers (only reachable when ordering is available
  // and a table is scanned, so `qr` is guaranteed non-null here).
  if (orderingAvailable && qr) {
    if (stage.name === 'checkout') {
      return (
        <CheckoutView
          qr={qr}
          currency={currency}
          locale={locale}
          onBack={() => setStage({ name: 'cart' })}
          onPaid={(orderId) => {
            setHasSession(true);
            setStage({ name: 'receipt', orderId });
          }}
        />
      );
    }
    if (stage.name === 'receipt') {
      return (
        <ReceiptView
          orderId={stage.orderId}
          qr={qr}
          currency={currency}
          locale={locale}
          onOrderMore={() => setStage({ name: 'menu' })}
        />
      );
    }
    if (stage.name === 'status') {
      return (
        <div
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-white"
          data-testid="status-view"
        >
          <header className="sticky top-0 flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3">
            <button
              type="button"
              onClick={() => setStage({ name: 'menu' })}
              aria-label={tStatus('backToMenu')}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600"
            >
              ←
            </button>
            <h1 className="flex-1 text-base font-semibold text-gray-900">{tStatus('title')}</h1>
          </header>
          <div className="mx-auto w-full max-w-md flex-1 px-4 py-4">
            <SessionOrders qr={qr} />
            <button
              type="button"
              onClick={() => setStage({ name: 'menu' })}
              className="mt-8 w-full rounded-xl bg-brand px-4 py-3.5 text-sm font-semibold text-white"
            >
              {tStatus('orderMore')}
            </button>
          </div>
        </div>
      );
    }
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

      <main className="mx-auto max-w-2xl px-4 pt-2" data-testid="menu-root">
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

      {/* Reattach affordance: a prior order on this table on this device. */}
      {orderingAvailable && hasSession ? (
        <button
          type="button"
          data-testid="view-my-orders"
          onClick={() => setStage({ name: 'status' })}
          className="mx-auto mt-4 block text-sm font-medium text-brand-accent underline-offset-2 hover:underline"
        >
          {tStatus('viewMyOrders')}
        </button>
      ) : null}

      {orderingAvailable ? (
        <CartBar currency={currency} locale={locale} onOpen={() => setStage({ name: 'cart' })} />
      ) : null}

      {orderingAvailable && stage.name === 'cart' ? (
        <CartView
          currency={currency}
          locale={locale}
          onClose={() => setStage({ name: 'menu' })}
          onCheckout={() => setStage({ name: 'checkout' })}
        />
      ) : null}
    </div>
  );
}
