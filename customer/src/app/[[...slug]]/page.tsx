import MenuView from '@/components/MenuView';
import ReservePage from '@/components/reserve/ReservePage';

/**
 * Single catch-all storefront route. The first path segment is the restaurant
 * slug (resolved by TenantProvider); an optional second segment selects the
 * sub-page. A real optional catch-all (`[[...slug]]`) cannot coexist with a
 * sibling dynamic route at the root, so sub-routes branch here instead:
 *
 *   /<slug>          -> menu storefront
 *   /<slug>/reserve  -> public reservation booking
 */
export default function Page({ params }: { params: { slug?: string[] } }) {
  const segments = params.slug ?? [];
  if (segments[1] === 'reserve') return <ReservePage />;
  return <MenuView />;
}
