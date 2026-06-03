'use client';

import { useParams } from 'next/navigation';
import { OrderBuilder } from '@/components/order/OrderBuilder';

/**
 * Core POS order builder. Two-pane: menu (left) + current order (right).
 * (Replaces the P2 placeholder.)
 */
export default function OrderPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  if (!id) return null;
  return <OrderBuilder orderId={id} />;
}
