import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { CatalogBundle } from '../catalog-bundle';

/**
 * Renders a catalog bundle into a flat XLSX workbook for human review (BR-6 §F).
 * Two sheets — Inventory Items and Menu Items (with prices). This is a
 * review/export artifact only; import always consumes the JSON bundle.
 */
@Injectable()
export class CatalogWorkbookService {
  async build(bundle: CatalogBundle): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Restaurant OS';
    wb.created = new Date();

    const inv = wb.addWorksheet('Inventory Items');
    inv.columns = [
      { header: 'Key', key: 'key', width: 24 },
      { header: 'Name', key: 'name', width: 32 },
      { header: 'SKU', key: 'sku', width: 18 },
      { header: 'Category', key: 'categoryKey', width: 24 },
      { header: 'Kind', key: 'kind', width: 12 },
      { header: 'Base Unit', key: 'baseUnit', width: 12 },
      { header: 'Track Expiry', key: 'trackExpiry', width: 12 },
      { header: 'Low Stock Threshold (base)', key: 'lowStockThresholdBase', width: 24 },
    ];
    inv.getRow(1).font = { bold: true };
    for (const it of bundle.sections.inventoryItems) {
      inv.addRow({
        key: it.key,
        name: it.name,
        sku: it.sku ?? '',
        categoryKey: it.categoryKey ?? '',
        kind: it.kind,
        baseUnit: it.baseUnit,
        trackExpiry: it.trackExpiry ? 'YES' : 'NO',
        lowStockThresholdBase: it.lowStockThresholdBase ?? '',
      });
    }

    const menu = wb.addWorksheet('Menu Items');
    menu.columns = [
      { header: 'Key (code)', key: 'key', width: 20 },
      { header: 'Category', key: 'categoryKey', width: 20 },
      { header: 'Name', key: 'name', width: 32 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Price (minor units)', key: 'priceAmount', width: 18 },
      { header: 'Prep Station', key: 'prepStation', width: 14 },
      { header: 'Prep Time (min)', key: 'prepTimeMinutes', width: 16 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Availability', key: 'availability', width: 14 },
      { header: 'Modifier Groups', key: 'modifierGroups', width: 20 },
    ];
    menu.getRow(1).font = { bold: true };
    for (const it of bundle.sections.menuItems) {
      menu.addRow({
        key: it.key,
        categoryKey: it.categoryKey,
        name: it.name,
        description: it.description ?? '',
        priceAmount: it.priceAmount,
        prepStation: it.prepStation,
        prepTimeMinutes: it.prepTimeMinutes ?? '',
        status: it.status,
        availability: it.availability,
        modifierGroups: it.modifierGroups.length,
      });
    }

    const out = await wb.xlsx.writeBuffer();
    return Buffer.from(out);
  }
}
