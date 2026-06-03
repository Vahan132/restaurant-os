'use client';

import { useParams } from 'next/navigation';
import { CheckoutScreen } from '@/components/checkout/CheckoutScreen';

/** Checkout: payments, splits, close, and printable receipt. (Replaces P4 placeholder.) */
export default function CheckoutPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  if (!id) return null;
  return <CheckoutScreen orderId={id} />;
}
