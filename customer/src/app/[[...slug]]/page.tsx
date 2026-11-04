import MenuView from '@/components/MenuView';

/**
 * Single catch-all storefront route. The first path segment is the restaurant
 * slug (resolved by TenantProvider). The QR menu is an at-the-table surface:
 * browse menu -> order -> waiter confirmation. Booking lives in the consumer
 * app, not here.
 *
 *   /<slug>  -> menu storefront
 */
export default function Page() {
  return <MenuView />;
}
