import { ImportedSale as PrismaImportedSale } from '@prisma/client';
import { ImportedSale } from '../../domain/entities/imported-sale';

export class ImportedSaleMapper {
  static toCreate(sale: ImportedSale) {
    return {
      id: sale.id,
      restaurantId: sale.restaurantId,
      branchId: sale.branchId,
      importBatchId: sale.importBatchId,
      occurredAt: sale.occurredAt,
      itemDescription: sale.itemDescription,
      itemId: sale.itemId,
      quantity: sale.quantity,
      unitPriceAmount: sale.unitPriceAmount,
      lineTotalAmount: sale.lineTotalAmount,
      paymentMethod: sale.paymentMethod,
      externalReference: sale.externalReference,
      createdAt: sale.createdAt,
    };
  }

  static toDomain(record: PrismaImportedSale): ImportedSale {
    return ImportedSale.reconstitute(record.id, {
      restaurantId: record.restaurantId,
      branchId: record.branchId,
      importBatchId: record.importBatchId,
      occurredAt: record.occurredAt,
      itemDescription: record.itemDescription,
      itemId: record.itemId,
      quantity: record.quantity,
      unitPriceAmount: record.unitPriceAmount,
      lineTotalAmount: record.lineTotalAmount,
      paymentMethod: record.paymentMethod,
      externalReference: record.externalReference,
      createdAt: record.createdAt,
    });
  }
}
