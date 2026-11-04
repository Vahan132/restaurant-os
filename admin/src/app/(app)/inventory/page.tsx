import { redirect } from 'next/navigation';

/** Inventory landing redirects to the default Stock screen. */
export default function InventoryIndexPage() {
  redirect('/inventory/stock');
}
