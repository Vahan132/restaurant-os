import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  InventoryReportReader,
  ReportScopeFilter,
  StockOnHandReport,
  StockOnHandReportRow,
  ValuationBucket,
  ValuationSummary,
} from '../../application/ports/inventory-report.reader';
import { StockLayerStatus } from '../../domain/enums';
import { costFromUnitCostMicro, roundedDiv } from '../../domain/value-objects/money';

/**
 * Inventory stock reports (6D). Reads from the projections (StockOnHand for
 * quantities, StockLayer for FIFO value); the ledger stays the source of truth.
 * Per-(item, location) value rolls up to branch totals exactly by construction
 * (every row valued independently and summed). Negative on-hand is valued at the
 * item's last known unit cost (§1). Scoped to an explicit, access-checked set of
 * branchIds.
 */
@Injectable()
export class PrismaInventoryReportReader implements InventoryReportReader {
  constructor(private readonly prisma: PrismaService) {}

  async stockOnHand(
    filter: ReportScopeFilter & { lowStockOnly?: boolean },
  ): Promise<StockOnHandReport> {
    let rows = await this.buildRows(filter);
    if (filter.lowStockOnly) {
      rows = rows.filter((r) => r.lowStock);
    }
    const total = rows.length;
    const totalValuationAmount = rows.reduce((s, r) => s + r.valuationAmount, 0);
    // INV-SEARCH-1: no slice here — the use-case sorts by resolved name then paginates.
    return { rows, total, totalValuationAmount };
  }

  async valuationSummary(filter: ReportScopeFilter): Promise<ValuationSummary> {
    const rows = await this.buildRows(filter);

    const byLocationMap = new Map<string, ValuationBucket>();
    const byBranchMap = new Map<string, ValuationBucket>();
    let totalValuationAmount = 0;
    for (const r of rows) {
      totalValuationAmount += r.valuationAmount;

      const locKey = `${r.branchId}|${r.locationId}`;
      const loc = byLocationMap.get(locKey);
      if (loc) {
        loc.valuationAmount += r.valuationAmount;
      } else {
        byLocationMap.set(locKey, {
          branchId: r.branchId,
          locationId: r.locationId,
          locationName: r.locationName,
          valuationAmount: r.valuationAmount,
        });
      }

      const br = byBranchMap.get(r.branchId);
      if (br) {
        br.valuationAmount += r.valuationAmount;
      } else {
        byBranchMap.set(r.branchId, {
          branchId: r.branchId,
          locationId: null,
          locationName: null,
          valuationAmount: r.valuationAmount,
        });
      }
    }
    return {
      byLocation: [...byLocationMap.values()],
      byBranch: [...byBranchMap.values()],
      totalValuationAmount,
    };
  }

  async lowStock(filter: ReportScopeFilter): Promise<StockOnHandReportRow[]> {
    const rows = await this.buildRows(filter);
    return rows.filter((r) => r.lowStock);
  }

  async negativeStock(filter: ReportScopeFilter): Promise<StockOnHandReportRow[]> {
    const rows = await this.buildRows(filter);
    return rows.filter((r) => r.quantity < 0);
  }

  /**
   * Build every in-scope (item, location) row with its quantity, value, and
   * low-stock flag. Shared by all four reports.
   */
  private async buildRows(filter: ReportScopeFilter): Promise<StockOnHandReportRow[]> {
    if (filter.branchIds.length === 0) {
      return []; // caller reaches no branch — isolation holds
    }
    const onHandWhere: Prisma.StockOnHandWhereInput = {
      restaurantId: filter.restaurantId,
      branchId: { in: filter.branchIds },
      ...(filter.locationId ? { locationId: filter.locationId } : {}),
      ...(filter.itemId ? { itemId: filter.itemId } : {}),
    };
    const onHand = await this.prisma.stockOnHand.findMany({ where: onHandWhere });
    if (onHand.length === 0) {
      return [];
    }

    const itemIds = [...new Set(onHand.map((r) => r.itemId))];
    const locationIds = [...new Set(onHand.map((r) => r.locationId))];
    const [items, locations, openLayers] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where: { id: { in: itemIds }, ...(filter.categoryId ? { categoryId: filter.categoryId } : {}) },
        select: {
          id: true,
          name: true,
          catalogItemId: true,
          sku: true,
          categoryId: true,
          baseUnit: true,
          lowStockThresholdBase: true,
          lastUnitCostMicro: true,
        },
      }),
      this.prisma.inventoryLocation.findMany({
        where: { id: { in: locationIds } },
        select: { id: true, name: true },
      }),
      this.prisma.stockLayer.findMany({
        where: {
          restaurantId: filter.restaurantId,
          branchId: { in: filter.branchIds },
          itemId: { in: itemIds },
          status: StockLayerStatus.OPEN,
          baseQtyRemaining: { gt: 0 },
          ...(filter.locationId ? { locationId: filter.locationId } : {}),
        },
        select: {
          itemId: true,
          locationId: true,
          baseQtyReceived: true,
          baseQtyRemaining: true,
          lineTotalCostAmount: true,
        },
      }),
    ]);

    const itemById = new Map(items.map((i) => [i.id, i]));
    const locationName = new Map(locations.map((l) => [l.id, l.name]));
    const layerValue = new Map<string, number>();
    for (const l of openLayers) {
      const key = `${l.itemId}|${l.locationId}`;
      const value = roundedDiv(l.lineTotalCostAmount * l.baseQtyRemaining, l.baseQtyReceived);
      layerValue.set(key, (layerValue.get(key) ?? 0) + value);
    }

    const rows: StockOnHandReportRow[] = [];
    for (const r of onHand) {
      const item = itemById.get(r.itemId);
      if (!item) {
        continue; // excluded by the category filter (or a soft-deleted item)
      }
      const eff = r.lowStockThresholdBase ?? item.lowStockThresholdBase;
      const key = `${r.itemId}|${r.locationId}`;
      // FIFO value for positive on-hand; negative valued at last known unit cost.
      const valuationAmount =
        r.quantity >= 0
          ? (layerValue.get(key) ?? 0)
          : -costFromUnitCostMicro(item.lastUnitCostMicro ?? 0n, -r.quantity);
      rows.push({
        branchId: r.branchId,
        locationId: r.locationId,
        locationName: locationName.get(r.locationId) ?? '',
        itemId: r.itemId,
        itemName: item.name,
        catalogItemId: item.catalogItemId,
        sku: item.sku,
        categoryId: item.categoryId,
        baseUnit: item.baseUnit,
        quantity: r.quantity,
        valuationAmount,
        lowStockThresholdBase: eff,
        lowStock: eff !== null && r.quantity <= eff,
      });
    }
    // INV-SEARCH-1: no name sort here — itemName is the LOCAL name (null for adopted), so
    // sorting on it clusters adopted rows. The use-case sorts by the RESOLVED effective
    // name after attachCatalogNames, keeping all three list paths consistent.
    return rows;
  }
}
