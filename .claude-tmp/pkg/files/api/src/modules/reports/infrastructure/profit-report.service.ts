import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  currencyDecimals,
  formatReportDate,
  renderReportWorkbook,
  ReportRow,
  ReportSheet,
} from '../../../shared/infrastructure/excel/report-workbook';
import { NoRestaurantInScope } from '../application/application.errors';
import { ItemRow, REPORTS_QUERY, ReportsQuery } from '../application/ports/reports-query.port';
import { inclusiveDayRange } from '../application/report-time.util';

export type ReportLang = 'hy' | 'ru' | 'en';

export interface ProfitWriteOffLine {
  writeOffId: string;
  occurredAt: string;
  reason: string;
  note: string | null;
  kind: 'ITEM' | 'DISH';
  name: string;
  qty: number;
  unit: string;
  costAmount: number;
}

export interface ProfitExpenseLine {
  id: string;
  occurredAt: string;
  categoryName: string | null;
  description: string;
  note: string | null;
  amount: number;
  createdByName: string | null;
}

export interface ProfitTotals {
  /** Sum of sold line totals (before order-level discounts). */
  salesAmount: number;
  discountAmount: number;
  /** Closed orders total (what was actually charged). */
  revenueAmount: number;
  costAmount: number;
  grossProfitAmount: number;
  writeOffAmount: number;
  expenseAmount: number;
  netProfitAmount: number;
}

export interface ProfitReportData {
  from: string;
  to: string;
  restaurantName: string;
  currency: string;
  locations: string[];
  totals: ProfitTotals;
  products: ItemRow[];
  writeOffs: ProfitWriteOffLine[];
  expenses: ProfitExpenseLine[];
}

// ── Labels (the export follows the admin's UI language) ─────────────────────

type Dict = Record<string, string>;
const L: Record<ReportLang, Dict> = {
  ru: {
    salesTitle: 'Отчет о продажах с {from} по {to}',
    profitTitle: 'Отчет о прибыли с {from} по {to}',
    writeOffTitle: 'Списания с {from} по {to}',
    expenseTitle: 'Расходы с {from} по {to}',
    period: 'За период: с {from} по {to}',
    warehouses: 'Склад(ы): {list}',
    sheetSummary: 'Прибыль',
    sheetSales: 'Продажи',
    sheetWriteOffs: 'Списания',
    sheetExpenses: 'Расходы',
    group: 'Группа',
    item: 'Элемент номенклатуры',
    qty: 'Количество',
    revenue: 'Выручка, {cur}',
    cost: 'Себестоимость, {cur}',
    costPct: 'Себестоимость, %',
    gross: 'Валовая прибыль, {cur}',
    markup: 'Наценка, %',
    total: 'Итого',
    noGroup: 'Без группы',
    estimated: '* себестоимость частично рассчитана по техкарте (нет движения склада)',
    date: 'Дата',
    reason: 'Причина',
    type: 'Тип',
    unit: 'Ед. изм.',
    note: 'Комментарий',
    amount: 'Сумма, {cur}',
    category: 'Категория',
    description: 'Описание',
    createdBy: 'Добавил',
    noCategory: 'Без категории',
    dish: 'Блюдо',
    ingredient: 'Товар',
    pcs: 'шт',
    metric: 'Показатель',
    value: 'Сумма, {cur}',
    share: '% от выручки',
    salesAmount: 'Продажи по позициям',
    discountAmount: 'Скидки',
    revenueAmount: 'Выручка (закрытые заказы)',
    costAmount: 'Себестоимость проданного',
    grossProfitAmount: 'Валовая прибыль',
    writeOffAmount: 'Списания',
    expenseAmount: 'Расходы',
    netProfitAmount: 'Чистая прибыль',
    STAFF_MEAL: 'Питание персонала',
    SPOILAGE: 'Порча',
    WASTE: 'Отходы',
    BREAKAGE: 'Бой / поломка',
    THEFT: 'Кража',
    OTHER: 'Другое',
  },
  en: {
    salesTitle: 'Sales report from {from} to {to}',
    profitTitle: 'Profit report from {from} to {to}',
    writeOffTitle: 'Write-offs from {from} to {to}',
    expenseTitle: 'Expenses from {from} to {to}',
    period: 'Period: from {from} to {to}',
    warehouses: 'Warehouse(s): {list}',
    sheetSummary: 'Profit',
    sheetSales: 'Sales',
    sheetWriteOffs: 'Write-offs',
    sheetExpenses: 'Expenses',
    group: 'Group',
    item: 'Item',
    qty: 'Quantity',
    revenue: 'Revenue, {cur}',
    cost: 'Cost price, {cur}',
    costPct: 'Cost price, %',
    gross: 'Gross profit, {cur}',
    markup: 'Markup, %',
    total: 'Total',
    noGroup: 'No group',
    estimated: '* cost partly estimated from the recipe (no stock movement)',
    date: 'Date',
    reason: 'Reason',
    type: 'Type',
    unit: 'Unit',
    note: 'Note',
    amount: 'Amount, {cur}',
    category: 'Category',
    description: 'Description',
    createdBy: 'Added by',
    noCategory: 'No category',
    dish: 'Dish',
    ingredient: 'Item',
    pcs: 'pcs',
    metric: 'Metric',
    value: 'Amount, {cur}',
    share: '% of revenue',
    salesAmount: 'Sales by items',
    discountAmount: 'Discounts',
    revenueAmount: 'Revenue (closed orders)',
    costAmount: 'Cost of goods sold',
    grossProfitAmount: 'Gross profit',
    writeOffAmount: 'Write-offs',
    expenseAmount: 'Expenses',
    netProfitAmount: 'Net profit',
    STAFF_MEAL: 'Staff meal',
    SPOILAGE: 'Spoilage',
    WASTE: 'Waste',
    BREAKAGE: 'Breakage',
    THEFT: 'Theft',
    OTHER: 'Other',
  },
  hy: {
    salesTitle: 'Վաճառքների հաշվետվություն {from} – {to}',
    profitTitle: 'Շահույթի հաշվետվություն {from} – {to}',
    writeOffTitle: 'Դուրսգրումներ {from} – {to}',
    expenseTitle: 'Ծախսեր {from} – {to}',
    period: 'Ժամանակահատված՝ {from} – {to}',
    warehouses: 'Պահեստ(ներ)՝ {list}',
    sheetSummary: 'Շահույթ',
    sheetSales: 'Վաճառք',
    sheetWriteOffs: 'Դուրսգրումներ',
    sheetExpenses: 'Ծախսեր',
    group: 'Խումբ',
    item: 'Անվանում',
    qty: 'Քանակ',
    revenue: 'Հասույթ, {cur}',
    cost: 'Ինքնարժեք, {cur}',
    costPct: 'Ինքնարժեք, %',
    gross: 'Համախառն շահույթ, {cur}',
    markup: 'Հավելագին, %',
    total: 'Ընդամենը',
    noGroup: 'Առանց խմբի',
    estimated: '* ինքնարժեքը մասամբ հաշվարկված է բաղադրատոմսով (պահեստային շարժ չկա)',
    date: 'Ամսաթիվ',
    reason: 'Պատճառ',
    type: 'Տեսակ',
    unit: 'Միավոր',
    note: 'Նշում',
    amount: 'Գումար, {cur}',
    category: 'Կատեգորիա',
    description: 'Նկարագրություն',
    createdBy: 'Ավելացրել է',
    noCategory: 'Առանց կատեգորիայի',
    dish: 'Ուտեստ',
    ingredient: 'Ապրանք',
    pcs: 'հատ',
    metric: 'Ցուցանիշ',
    value: 'Գումար, {cur}',
    share: '% հասույթից',
    salesAmount: 'Վաճառք ըստ ապրանքների',
    discountAmount: 'Զեղչեր',
    revenueAmount: 'Հասույթ (փակված պատվերներ)',
    costAmount: 'Վաճառվածի ինքնարժեք',
    grossProfitAmount: 'Համախառն շահույթ',
    writeOffAmount: 'Դուրսգրումներ',
    expenseAmount: 'Ծախսեր',
    netProfitAmount: 'Զուտ շահույթ',
    STAFF_MEAL: 'Անձնակազմի սնունդ',
    SPOILAGE: 'Փչացում',
    WASTE: 'Թափոն',
    BREAKAGE: 'Կոտրվածք',
    THEFT: 'Գողություն',
    OTHER: 'Այլ',
  },
};

function tr(lang: ReportLang, key: string, vars: Record<string, string> = {}): string {
  const raw = L[lang][key] ?? L.en[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (_m, k: string) => vars[k] ?? '');
}

const ratio = (num: number, den: number): number | null => (den !== 0 ? num / den : null);

/**
 * PROFIT-XLSX-1: period profit picture — sales by product with FIFO cost price,
 * write-offs, and non-stock expenses — plus its iiko-style Excel rendering.
 * Restaurant-wide like the rest of the sales reports (CLOSED orders by closedAt).
 */
@Injectable()
export class ProfitReportService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REPORTS_QUERY) private readonly q: ReportsQuery,
  ) {}

  async collect(
    restaurantId: string | null,
    from: string,
    to: string,
    lang: ReportLang = 'ru',
  ): Promise<ProfitReportData> {
    if (!restaurantId) throw NoRestaurantInScope();
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId },
      select: { name: true, currency: true, timezone: true },
    });
    const tz = restaurant?.timezone ?? 'UTC';
    const { start, end } = inclusiveDayRange(from, to, tz);

    const [products, summary, writeOffs, expenses, locations] = await Promise.all([
      this.q.salesByItem(restaurantId, start, end),
      this.q.salesSummary(restaurantId, start, end),
      this.writeOffLines(restaurantId, start, end, lang),
      this.expenseLines(restaurantId, start, end),
      this.locationNames(restaurantId),
    ]);

    const salesAmount = products.reduce((s, p) => s + p.revenueAmount, 0);
    const costAmount = products.reduce((s, p) => s + p.costAmount, 0);
    const revenueAmount = summary.totalRevenueAmount;
    const writeOffAmount = writeOffs.reduce((s, w) => s + w.costAmount, 0);
    const expenseAmount = expenses.reduce((s, e) => s + e.amount, 0);
    const grossProfitAmount = revenueAmount - costAmount;

    return {
      from,
      to,
      restaurantName: restaurant?.name ?? '',
      currency: restaurant?.currency ?? 'AMD',
      locations,
      totals: {
        salesAmount,
        discountAmount: summary.totalDiscountAmount,
        revenueAmount,
        costAmount,
        grossProfitAmount,
        writeOffAmount,
        expenseAmount,
        netProfitAmount: grossProfitAmount - writeOffAmount - expenseAmount,
      },
      products,
      writeOffs,
      expenses,
    };
  }

  async locationNames(restaurantId: string): Promise<string[]> {
    const rows = await this.prisma.inventoryLocation.findMany({
      where: { restaurantId, deletedAt: null, status: 'ACTIVE' },
      select: { name: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return [...new Set(rows.map((r) => r.name))];
  }

  private async writeOffLines(
    restaurantId: string,
    start: Date,
    end: Date,
    lang: ReportLang,
  ): Promise<ProfitWriteOffLine[]> {
    const writeOffs = await this.prisma.writeOff.findMany({
      where: { restaurantId, voidedAt: null, occurredAt: { gte: start, lt: end } },
      include: { lines: true },
      orderBy: { occurredAt: 'asc' },
    });
    const itemIds = new Set<string>();
    const menuIds = new Set<string>();
    for (const w of writeOffs) {
      for (const l of w.lines) {
        if (l.itemId) itemIds.add(l.itemId);
        if (l.menuItemId) menuIds.add(l.menuItemId);
      }
    }
    const [items, menus] = await Promise.all([
      itemIds.size
        ? this.prisma.inventoryItem.findMany({
            where: { id: { in: [...itemIds] } },
            select: { id: true, name: true, catalogItemId: true, baseUnit: true },
          })
        : Promise.resolve([]),
      menuIds.size
        ? this.prisma.menuItem.findMany({
            where: { id: { in: [...menuIds] } },
            select: { id: true, name: true, nameHy: true, nameRu: true, nameEn: true },
          })
        : Promise.resolve([]),
    ]);
    const catalogIds = items.map((i) => i.catalogItemId).filter((x): x is string => !!x);
    const catalog = catalogIds.length
      ? await this.prisma.catalogItem.findMany({
          where: { id: { in: catalogIds } },
          select: { id: true, nameHy: true, nameRu: true, nameEn: true },
        })
      : [];
    const catalogById = new Map(catalog.map((c) => [c.id, c]));
    const pickCatalog = (c: { nameHy: string; nameRu: string; nameEn: string }) =>
      lang === 'hy' ? c.nameHy : lang === 'ru' ? c.nameRu : c.nameEn;
    const itemById = new Map(items.map((i) => [i.id, i]));
    const menuById = new Map(menus.map((m) => [m.id, m]));

    const out: ProfitWriteOffLine[] = [];
    for (const w of writeOffs) {
      for (const l of w.lines) {
        let name = '';
        let qty = 0;
        let unit = '';
        if (l.kind === 'DISH') {
          const m = l.menuItemId ? menuById.get(l.menuItemId) : undefined;
          const localized = m && (lang === 'hy' ? m.nameHy : lang === 'ru' ? m.nameRu : m.nameEn);
          name = localized || m?.name || l.menuItemId || '';
          qty = l.units ?? 0;
          unit = tr(lang, 'pcs');
        } else {
          const it = l.itemId ? itemById.get(l.itemId) : undefined;
          const cat = it?.catalogItemId ? catalogById.get(it.catalogItemId) : undefined;
          name = (cat ? pickCatalog(cat) : null) || it?.name || l.itemId || '';
          if (l.enteredQty !== null && l.enteredUnit) {
            qty = l.enteredQty;
            unit = l.enteredUnit;
          } else {
            qty = l.baseQty ?? 0;
            unit = it?.baseUnit ?? '';
          }
        }
        out.push({
          writeOffId: w.id,
          occurredAt: w.occurredAt.toISOString(),
          reason: w.reason,
          note: w.note,
          kind: l.kind,
          name,
          qty,
          unit,
          costAmount: l.costAmount,
        });
      }
    }
    return out;
  }

  private async expenseLines(
    restaurantId: string,
    start: Date,
    end: Date,
  ): Promise<ProfitExpenseLine[]> {
    const rows = await this.prisma.expense.findMany({
      where: { restaurantId, deletedAt: null, occurredAt: { gte: start, lt: end } },
      include: { category: { select: { name: true } } },
      orderBy: { occurredAt: 'asc' },
    });
    const userIds = [...new Set(rows.map((r) => r.createdByUserId))];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, fullName: true },
        })
      : [];
    const names = new Map(users.map((u) => [u.id, u.fullName]));
    return rows.map((r) => ({
      id: r.id,
      occurredAt: r.occurredAt.toISOString(),
      categoryName: r.category?.name ?? null,
      description: r.description,
      note: r.note,
      amount: r.amount,
      createdByName: names.get(r.createdByUserId) ?? null,
    }));
  }

  async timezone(restaurantId: string | null): Promise<string> {
    if (!restaurantId) throw NoRestaurantInScope();
    return this.q.timezone(restaurantId);
  }

  /** "За период: …" + "Склад(ы): …" header lines. */
  infoLines(data: ProfitReportData, lang: ReportLang): string[] {
    const vars = { from: formatReportDate(data.from), to: formatReportDate(data.to) };
    return [
      tr(lang, 'period', vars),
      tr(lang, 'warehouses', { list: data.locations.join(', ') || '—' }),
    ];
  }

  // ── Excel ───────────────────────────────────────────────────────────────

  async workbook(data: ProfitReportData, lang: ReportLang, timeZone: string): Promise<Buffer> {
    const decimals = currencyDecimals(data.currency);
    const major = (minor: number) => minor / 10 ** decimals;
    const cur = data.currency;
    const vars = { from: formatReportDate(data.from), to: formatReportDate(data.to), cur };
    const info = this.infoLines(data, lang);
    const localDate = (iso: string) => {
      const d = new Date(iso);
      const f = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(d);
      const p = Object.fromEntries(f.map((x) => [x.type, x.value]));
      return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
    };

    // Summary
    const t = data.totals;
    const summaryMetrics: Array<keyof ProfitTotals> = [
      'salesAmount',
      'discountAmount',
      'revenueAmount',
      'costAmount',
      'grossProfitAmount',
      'writeOffAmount',
      'expenseAmount',
      'netProfitAmount',
    ];
    const summary: ReportSheet = {
      name: tr(lang, 'sheetSummary'),
      title: `${tr(lang, 'profitTitle', vars)}${data.restaurantName ? ` · ${data.restaurantName}` : ''}`,
      infoLines: info,
      columns: [
        { header: tr(lang, 'metric'), kind: 'text', width: 40 },
        { header: tr(lang, 'value', vars), kind: 'money', width: 22 },
        { header: tr(lang, 'share'), kind: 'percent', width: 16 },
      ],
      rows: summaryMetrics.map<ReportRow>((k) => ({
        cells: [tr(lang, k), major(t[k]), ratio(t[k], t.revenueAmount)],
        style:
          k === 'netProfitAmount' ? 'total' : k === 'grossProfitAmount' ? 'subtotal' : undefined,
      })),
    };

    return renderReportWorkbook(
      [
        summary,
        buildSalesSheet(data.products, lang, vars, info, major),
        this.writeOffSheet(data, lang, vars, info, major, localDate),
        this.expenseSheet(data, lang, vars, info, major, localDate),
      ],
      { moneyDecimals: decimals },
    );
  }

  private writeOffSheet(
    data: ProfitReportData,
    lang: ReportLang,
    vars: Record<string, string>,
    info: string[],
    major: (n: number) => number,
    localDate: (iso: string) => string,
  ): ReportSheet {
    const rows: ReportRow[] = data.writeOffs.map((w) => ({
      cells: [
        localDate(w.occurredAt),
        tr(lang, w.reason),
        tr(lang, w.kind === 'DISH' ? 'dish' : 'ingredient'),
        w.name,
        w.qty,
        w.unit,
        major(w.costAmount),
        w.note ?? '',
      ],
    }));
    rows.push({
      cells: [
        tr(lang, 'total'),
        null,
        null,
        null,
        null,
        null,
        major(data.totals.writeOffAmount),
        null,
      ],
      style: 'total',
    });
    return {
      name: tr(lang, 'sheetWriteOffs'),
      title: tr(lang, 'writeOffTitle', vars),
      infoLines: info,
      columns: [
        { header: tr(lang, 'date'), kind: 'date' },
        { header: tr(lang, 'reason'), kind: 'text', width: 20 },
        { header: tr(lang, 'type'), kind: 'text', width: 12 },
        { header: tr(lang, 'item'), kind: 'text', width: 36 },
        { header: tr(lang, 'qty'), kind: 'qty', width: 12 },
        { header: tr(lang, 'unit'), kind: 'text', width: 10 },
        { header: tr(lang, 'cost', vars), kind: 'money' },
        { header: tr(lang, 'note'), kind: 'text', width: 36 },
      ],
      rows,
    };
  }

  private expenseSheet(
    data: ProfitReportData,
    lang: ReportLang,
    vars: Record<string, string>,
    info: string[],
    major: (n: number) => number,
    localDate: (iso: string) => string,
  ): ReportSheet {
    const rows: ReportRow[] = data.expenses.map((e) => ({
      cells: [
        localDate(e.occurredAt),
        e.categoryName ?? tr(lang, 'noCategory'),
        e.description,
        major(e.amount),
        e.note ?? '',
        e.createdByName ?? '',
      ],
    }));
    rows.push({
      cells: [tr(lang, 'total'), null, null, major(data.totals.expenseAmount), null, null],
      style: 'total',
    });
    return {
      name: tr(lang, 'sheetExpenses'),
      title: tr(lang, 'expenseTitle', vars),
      infoLines: [info[0]],
      columns: [
        { header: tr(lang, 'date'), kind: 'date' },
        { header: tr(lang, 'category'), kind: 'text', width: 24 },
        { header: tr(lang, 'description'), kind: 'text', width: 40 },
        { header: tr(lang, 'amount', vars), kind: 'money' },
        { header: tr(lang, 'note'), kind: 'text', width: 36 },
        { header: tr(lang, 'createdBy'), kind: 'text', width: 22 },
      ],
      rows,
    };
  }
}

/**
 * The "Отчет о продажах" sheet: Group | Item | Qty | Revenue | Cost | Cost % |
 * Gross profit | Markup %, grouped by menu category with per-group subtotals.
 */
export function buildSalesSheet(
  products: ItemRow[],
  lang: ReportLang,
  vars: Record<string, string>,
  info: string[],
  major: (n: number) => number,
): ReportSheet {
  const groups = new Map<string, ItemRow[]>();
  for (const p of products) {
    const g = p.categoryName ?? tr(lang, 'noGroup');
    const list = groups.get(g) ?? [];
    list.push(p);
    groups.set(g, list);
  }
  const line = (
    group: string,
    name: string,
    qty: number,
    revenue: number,
    cost: number,
    style?: ReportRow['style'],
  ): ReportRow => ({
    cells: [
      group,
      name,
      qty,
      major(revenue),
      major(cost),
      ratio(cost, revenue),
      major(revenue - cost),
      ratio(revenue - cost, cost),
    ],
    style,
  });

  const rows: ReportRow[] = [];
  let anyEstimated = false;
  const sortedGroups = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const grand = { qty: 0, revenue: 0, cost: 0 };
  for (const [group, list] of sortedGroups) {
    const sub = { qty: 0, revenue: 0, cost: 0 };
    for (const p of [...list].sort((a, b) => b.revenueAmount - a.revenueAmount)) {
      if (p.costEstimated) anyEstimated = true;
      rows.push(
        line(
          group,
          p.costEstimated ? `${p.name} *` : p.name,
          p.quantity,
          p.revenueAmount,
          p.costAmount,
        ),
      );
      sub.qty += p.quantity;
      sub.revenue += p.revenueAmount;
      sub.cost += p.costAmount;
    }
    if (sortedGroups.length > 1) {
      rows.push(line(group, tr(lang, 'total'), sub.qty, sub.revenue, sub.cost, 'subtotal'));
    }
    grand.qty += sub.qty;
    grand.revenue += sub.revenue;
    grand.cost += sub.cost;
  }
  rows.push(line(tr(lang, 'total'), '', grand.qty, grand.revenue, grand.cost, 'total'));

  return {
    name: tr(lang, 'sheetSales'),
    title: tr(lang, 'salesTitle', vars),
    infoLines: anyEstimated ? [...info, tr(lang, 'estimated')] : info,
    columns: [
      { header: tr(lang, 'group'), kind: 'text', width: 24 },
      { header: tr(lang, 'item'), kind: 'text', width: 40 },
      { header: tr(lang, 'qty'), kind: 'qty', width: 14 },
      { header: tr(lang, 'revenue', vars), kind: 'money' },
      { header: tr(lang, 'cost', vars), kind: 'money' },
      { header: tr(lang, 'costPct'), kind: 'percent', width: 16 },
      { header: tr(lang, 'gross', vars), kind: 'money', width: 20 },
      { header: tr(lang, 'markup'), kind: 'percent', width: 14 },
    ],
    rows,
  };
}
