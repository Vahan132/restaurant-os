'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import type {
  CancelledItemResponse,
  CancelledOrderResponse,
  DiscountOrderResponse,
  ItemRowResponse,
  PaymentMethodResponse,
  TableRowResponse,
  WaiterRowResponse,
} from '@/api/generated/model';
import { SortableTable, type Column } from '@/components/reports/sortable-table';
import { formatMoney } from '@/lib/money';
import {
  useByItem,
  useByPaymentMethod,
  useByTable,
  useByWaiter,
  useCancellations,
  useDiscounts,
} from '@/lib/reports/use-reports-data';

const PIE_COLORS = ['#0f766e', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#65a30d'];

interface BreakdownProps {
  from: string;
  to: string;
  currency: string;
}

export function PaymentMethodBreakdown({ from, to, currency }: BreakdownProps) {
  const t = useTranslations('reports');
  const { rows, isLoading } = useByPaymentMethod(from, to);

  const columns: Column<PaymentMethodResponse>[] = [
    { key: 'method', label: t('byPayment.method'), cell: (r) => r.method, csv: (r) => r.method, sort: (r) => r.method },
    {
      key: 'amount',
      label: t('byPayment.amount'),
      align: 'right',
      cell: (r) => formatMoney(r.amount, currency),
      csv: (r) => r.amount,
      sort: (r) => r.amount,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <SortableTable
        title={t('byPayment.title')}
        rows={rows}
        columns={columns}
        csvName="payment-method"
        isLoading={isLoading}
        emptyText={t('empty')}
      />
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">{t('byPayment.title')}</h2>
        {rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">{t('empty')}</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={rows} dataKey="amount" nameKey="method" outerRadius={90} label>
                {rows.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatMoney(value, currency)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export function WaiterBreakdown({ from, to, currency }: BreakdownProps) {
  const t = useTranslations('reports');
  const { rows, isLoading } = useByWaiter(from, to);
  const columns: Column<WaiterRowResponse>[] = [
    { key: 'waiter', label: t('byWaiter.waiter'), cell: (r) => r.waiterName ?? t('byWaiter.unknown'), csv: (r) => r.waiterName ?? '', sort: (r) => r.waiterName ?? '' },
    { key: 'revenue', label: t('byWaiter.revenue'), align: 'right', cell: (r) => formatMoney(r.revenueAmount, currency), csv: (r) => r.revenueAmount, sort: (r) => r.revenueAmount },
    { key: 'orders', label: t('byWaiter.orders'), align: 'right', cell: (r) => r.orderCount, csv: (r) => r.orderCount, sort: (r) => r.orderCount },
  ];
  return <SortableTable title={t('byWaiter.title')} rows={rows} columns={columns} csvName="by-waiter" isLoading={isLoading} emptyText={t('empty')} />;
}

export function TableBreakdown({ from, to, currency }: BreakdownProps) {
  const t = useTranslations('reports');
  const { rows, isLoading } = useByTable(from, to);
  const columns: Column<TableRowResponse>[] = [
    { key: 'table', label: t('byTable.table'), cell: (r) => r.tableName ?? t('byTable.unassigned'), csv: (r) => r.tableName ?? '', sort: (r) => r.tableName ?? '' },
    { key: 'revenue', label: t('byTable.revenue'), align: 'right', cell: (r) => formatMoney(r.revenueAmount, currency), csv: (r) => r.revenueAmount, sort: (r) => r.revenueAmount },
    { key: 'orders', label: t('byTable.orders'), align: 'right', cell: (r) => r.orderCount, csv: (r) => r.orderCount, sort: (r) => r.orderCount },
  ];
  return <SortableTable title={t('byTable.title')} rows={rows} columns={columns} csvName="by-table" isLoading={isLoading} emptyText={t('empty')} />;
}

export function ItemBreakdown({ from, to, currency }: BreakdownProps) {
  const t = useTranslations('reports');
  const { rows, isLoading } = useByItem(from, to);
  const sorted = useMemo(() => [...rows].sort((a, b) => b.revenueAmount - a.revenueAmount), [rows]);
  const columns: Column<ItemRowResponse>[] = [
    { key: 'item', label: t('byItem.item'), cell: (r) => r.name, csv: (r) => r.name, sort: (r) => r.name },
    { key: 'qty', label: t('byItem.qty'), align: 'right', cell: (r) => r.quantity, csv: (r) => r.quantity, sort: (r) => r.quantity },
    { key: 'revenue', label: t('byItem.revenue'), align: 'right', cell: (r) => formatMoney(r.revenueAmount, currency), csv: (r) => r.revenueAmount, sort: (r) => r.revenueAmount },
  ];
  return <SortableTable title={t('byItem.title')} rows={sorted} columns={columns} csvName="by-item" isLoading={isLoading} emptyText={t('empty')} />;
}

export function DiscountsBreakdown({ from, to, currency }: BreakdownProps) {
  const t = useTranslations('reports');
  const { discounts, isLoading } = useDiscounts(from, to);
  const rows = discounts?.orders ?? [];
  const columns: Column<DiscountOrderResponse>[] = [
    { key: 'order', label: t('discounts.order'), cell: (r) => `#${r.orderNumber}`, csv: (r) => r.orderNumber, sort: (r) => r.orderNumber },
    { key: 'amount', label: t('discounts.amount'), align: 'right', cell: (r) => formatMoney(r.discountAmount, currency), csv: (r) => r.discountAmount, sort: (r) => r.discountAmount },
  ];
  return (
    <SortableTable
      title={`${t('discounts.title')} · ${t('discounts.total')}: ${formatMoney(discounts?.totalDiscountAmount ?? 0, currency)}`}
      rows={rows}
      columns={columns}
      csvName="discounts"
      isLoading={isLoading}
      emptyText={t('discounts.none')}
    />
  );
}

export function CancellationsBreakdown({ from, to, currency }: BreakdownProps) {
  const t = useTranslations('reports');
  const { cancellations, isLoading } = useCancellations(from, to);
  const orders = cancellations?.cancelledOrders ?? [];
  const items = cancellations?.cancelledItems ?? [];

  const orderCols: Column<CancelledOrderResponse>[] = [
    { key: 'order', label: t('cancellations.order'), cell: (r) => `#${r.orderNumber}`, csv: (r) => r.orderNumber, sort: (r) => r.orderNumber },
    { key: 'value', label: t('cancellations.value'), align: 'right', cell: (r) => formatMoney(r.totalAmount, currency), csv: (r) => r.totalAmount, sort: (r) => r.totalAmount },
    { key: 'reason', label: t('cancellations.reason'), cell: (r) => r.reason ?? t('cancellations.noReason'), csv: (r) => r.reason ?? '' },
  ];
  const itemCols: Column<CancelledItemResponse>[] = [
    { key: 'item', label: t('cancellations.item'), cell: (r) => r.name, csv: (r) => r.name, sort: (r) => r.name },
    { key: 'qty', label: t('cancellations.qty'), align: 'right', cell: (r) => r.quantity, csv: (r) => r.quantity, sort: (r) => r.quantity },
    { key: 'value', label: t('cancellations.value'), align: 'right', cell: (r) => formatMoney(r.lineTotalAmount, currency), csv: (r) => r.lineTotalAmount, sort: (r) => r.lineTotalAmount },
    { key: 'reason', label: t('cancellations.reason'), cell: (r) => r.reason ?? t('cancellations.noReason'), csv: (r) => r.reason ?? '' },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <SortableTable title={t('cancellations.ordersTitle')} rows={orders} columns={orderCols} csvName="cancelled-orders" isLoading={isLoading} emptyText={t('cancellations.none')} />
      <SortableTable title={t('cancellations.itemsTitle')} rows={items} columns={itemCols} csvName="cancelled-items" isLoading={isLoading} emptyText={t('cancellations.none')} />
    </div>
  );
}
