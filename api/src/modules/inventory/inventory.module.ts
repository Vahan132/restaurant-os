import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { PlatformCatalogModule } from '../platform-catalog/platform-catalog.module';

import { INVENTORY_STOCK_READER } from './application/ports/inventory-stock.reader';
import { STOCK_CONSUMPTION_PORT } from './domain/ports/stock-consumption.port';
import { INVENTORY_CATEGORY_REPOSITORY } from './domain/repositories/inventory-category.repository';
import { INVENTORY_ITEM_REPOSITORY } from './domain/repositories/inventory-item.repository';
import { INVENTORY_LEDGER_GATEWAY } from './domain/repositories/inventory-ledger.gateway';
import { GOODS_RECEIPT_REPOSITORY } from './domain/repositories/goods-receipt.repository';
import { STOCK_LAYER_REPOSITORY } from './domain/repositories/stock-layer.repository';
import { STOCK_MOVEMENT_REPOSITORY } from './domain/repositories/stock-movement.repository';
import { SUPPLIER_REPOSITORY } from './domain/repositories/supplier.repository';
import { PROCESS_REPOSITORY } from './domain/repositories/process.repository';
import { PROCESS_RUN_REPOSITORY } from './domain/repositories/process-run.repository';
import { PROCESS_GRAPH_READER } from './application/ports/process-graph.reader';
import { PROCESS_RUN_DETAIL_READER } from './application/ports/process-run-detail.reader';
import { RECIPE_REPOSITORY } from './domain/repositories/recipe.repository';
import { MENU_ITEM_LOOKUP } from './application/ports/menu-item.lookup';
import { ITEM_UNIT_COST_READER } from './application/ports/item-unit-cost.reader';
import { WRITE_OFF_REPOSITORY } from './domain/repositories/write-off.repository';
import { WRITE_OFF_SUMMARY_READER } from './application/ports/write-off-summary.reader';
import { INVENTORY_LOCATION_REPOSITORY } from './domain/repositories/inventory-location.repository';
import { BRANCH_INVENTORY_POLICY_REPOSITORY } from './domain/repositories/branch-inventory-policy.repository';
import { STOCK_ON_HAND_READER } from './application/ports/stock-on-hand.reader';
import { LOW_STOCK_ALERT_READER } from './application/ports/low-stock-alert.reader';
import { INVENTORY_TRANSFER_REPOSITORY } from './domain/repositories/inventory-transfer.repository';
import { INVENTORY_REPORT_READER } from './application/ports/inventory-report.reader';

import { CreateAdjustmentUseCase } from './application/commands/create-adjustment.usecase';
import { CreateGoodsReceiptUseCase } from './application/commands/create-goods-receipt.usecase';
import { AdoptCatalogItemUseCase } from './application/commands/adopt-catalog-item.usecase';
import { CreateInventoryItemUseCase } from './application/commands/create-inventory-item.usecase';
import { DeleteInventoryItemUseCase } from './application/commands/delete-inventory-item.usecase';
import { SetItemConsumptionLocationUseCase } from './application/commands/set-item-consumption-location.usecase';
import { UpdateInventoryItemUseCase } from './application/commands/update-inventory-item.usecase';
import {
  CreateInventoryCategoryUseCase,
  DeleteInventoryCategoryUseCase,
  UpdateInventoryCategoryUseCase,
} from './application/commands/manage-category.usecase';
import {
  CreateSupplierUseCase,
  DeleteSupplierUseCase,
  UpdateSupplierUseCase,
} from './application/commands/manage-supplier.usecase';
import { GetGoodsReceiptUseCase } from './application/queries/get-goods-receipt.usecase';
import { GetInventoryItemUseCase } from './application/queries/get-inventory-item.usecase';
import { GetItemLayersUseCase } from './application/queries/get-item-layers.usecase';
import { GetItemMovementsUseCase } from './application/queries/get-item-movements.usecase';
import { GetStockUseCase } from './application/queries/get-stock.usecase';
import { ListAdjustmentsUseCase } from './application/queries/list-adjustments.usecase';
import { ListGoodsReceiptsUseCase } from './application/queries/list-goods-receipts.usecase';
import { ListInventoryCategoriesUseCase } from './application/queries/list-inventory-categories.usecase';
import { ListInventoryItemsUseCase } from './application/queries/list-inventory-items.usecase';
import { ListSuppliersUseCase } from './application/queries/list-suppliers.usecase';
import { InventoryConsumptionService } from './application/services/inventory-consumption.service';

import { CreateProcessUseCase } from './application/commands/create-process.usecase';
import { UpdateProcessUseCase } from './application/commands/update-process.usecase';
import { DeleteProcessUseCase } from './application/commands/delete-process.usecase';
import { RunProcessUseCase } from './application/commands/run-process.usecase';
import { ListProcessesUseCase } from './application/queries/list-processes.usecase';
import { GetProcessUseCase } from './application/queries/get-process.usecase';
import { ListProcessRunsUseCase } from './application/queries/list-process-runs.usecase';
import { GetProcessRunUseCase } from './application/queries/get-process-run.usecase';
import { GetRelatedItemsUseCase } from './application/queries/get-related-items.usecase';
import { ProcessDefinitionAssembler } from './application/services/process-definition.assembler';
import { ProcessGraphCycleChecker } from './application/services/process-graph-cycle.checker';
import { ProducedItemGraphService } from './application/services/produced-item-graph.service';
import { PROCESS_GRAPH_EDGES_READER } from './application/ports/process-graph-edges.reader';
import { PrismaProcessGraphEdgesReader } from './infrastructure/persistence/prisma-process-graph-edges.reader';

import { CreateRecipeUseCase } from './application/commands/create-recipe.usecase';
import { UpdateRecipeUseCase } from './application/commands/update-recipe.usecase';
import { DeleteRecipeUseCase } from './application/commands/delete-recipe.usecase';
import { ListRecipesUseCase } from './application/queries/list-recipes.usecase';
import { GetRecipeUseCase } from './application/queries/get-recipe.usecase';
import { DishProjectionResolver } from './application/services/dish-projection.resolver';
import { InventoryItemNameResolver } from './application/services/inventory-item-name.resolver';
import { ITEM_RESOLUTION_READER } from './application/ports/item-resolution.reader';
import { PrismaItemResolutionReader } from './infrastructure/persistence/prisma-item-resolution.reader';
import { RecipeDefinitionAssembler } from './application/services/recipe-definition.assembler';
import { RecipeDetailAssembler } from './application/services/recipe-detail.assembler';
import { RecipeConsumptionService } from './application/services/recipe-consumption.service';
import { OrderConsumptionListener } from './application/listeners/order-consumption.listener';

import { CreateWriteOffUseCase } from './application/commands/create-write-off.usecase';
import { VoidWriteOffUseCase } from './application/commands/void-write-off.usecase';
import { ListWriteOffsUseCase } from './application/queries/list-write-offs.usecase';
import { GetWriteOffUseCase } from './application/queries/get-write-off.usecase';
import { GetWriteOffSummaryUseCase } from './application/queries/get-write-off-summary.usecase';

// Multi-location inventory (6A)
import {
  CreateInventoryLocationUseCase,
  DeleteInventoryLocationUseCase,
  RenameInventoryLocationUseCase,
} from './application/commands/manage-location.usecase';
import { ListLocationsUseCase } from './application/queries/list-locations.usecase';
import { GetLocationOnHandUseCase } from './application/queries/get-location-on-hand.usecase';
import { SetCountedOnHandUseCase } from './application/commands/set-counted-on-hand.usecase';
import {
  GetBranchPolicyUseCase,
  UpdateBranchPolicyUseCase,
} from './application/commands/manage-policy.usecase';
import { ListLowStockAlertsUseCase } from './application/queries/list-low-stock-alerts.usecase';
import { InventoryLocationProvisioner } from './application/services/inventory-location-provisioner.service';
import { NegativeStockPolicyService } from './application/services/negative-stock-policy.service';

// Within-branch transfers (6B)
import { CreateTransferUseCase } from './application/commands/create-transfer.usecase';
import { ListTransfersUseCase } from './application/queries/list-transfers.usecase';
import { GetTransferUseCase } from './application/queries/get-transfer.usecase';

// Stock reports (6D)
import {
  GetLowStockReportUseCase,
  GetNegativeStockReportUseCase,
  GetStockOnHandReportUseCase,
  GetValuationSummaryUseCase,
} from './application/queries/stock-reports.usecase';
import { GetMovementHistoryUseCase } from './application/queries/get-movement-history.usecase';
import { InventoryReportScopeService } from './application/services/inventory-report-scope.service';

import { PrismaGoodsReceiptRepository } from './infrastructure/persistence/prisma-goods-receipt.repository';
import { PrismaInventoryCategoryRepository } from './infrastructure/persistence/prisma-inventory-category.repository';
import { PrismaInventoryItemRepository } from './infrastructure/persistence/prisma-inventory-item.repository';
import { PrismaInventoryLedgerGateway } from './infrastructure/persistence/prisma-inventory-ledger.gateway';
import { PrismaInventoryStockReader } from './infrastructure/persistence/prisma-inventory-stock.reader';
import { PrismaStockLayerRepository } from './infrastructure/persistence/prisma-stock-layer.repository';
import { PrismaStockMovementRepository } from './infrastructure/persistence/prisma-stock-movement.repository';
import { PrismaSupplierRepository } from './infrastructure/persistence/prisma-supplier.repository';
import { PrismaProcessRepository } from './infrastructure/persistence/prisma-process.repository';
import { PrismaProcessRunRepository } from './infrastructure/persistence/prisma-process-run.repository';
import { PrismaProcessGraphReader } from './infrastructure/persistence/prisma-process-graph.reader';
import { PrismaProcessRunDetailReader } from './infrastructure/persistence/prisma-process-run-detail.reader';
import { PrismaRecipeRepository } from './infrastructure/persistence/prisma-recipe.repository';
import { PrismaMenuItemLookup } from './infrastructure/persistence/prisma-menu-item.lookup';
import { PrismaItemUnitCostReader } from './infrastructure/persistence/prisma-item-unit-cost.reader';
import { PrismaWriteOffRepository } from './infrastructure/persistence/prisma-write-off.repository';
import { PrismaWriteOffSummaryReader } from './infrastructure/persistence/prisma-write-off-summary.reader';
import { PrismaInventoryLocationRepository } from './infrastructure/persistence/prisma-inventory-location.repository';
import { PrismaBranchInventoryPolicyRepository } from './infrastructure/persistence/prisma-branch-inventory-policy.repository';
import { PrismaStockOnHandReader } from './infrastructure/persistence/prisma-stock-on-hand.reader';
import { PrismaLowStockAlertReader } from './infrastructure/persistence/prisma-low-stock-alert.reader';
import { PrismaInventoryTransferRepository } from './infrastructure/persistence/prisma-inventory-transfer.repository';
import { PrismaInventoryReportReader } from './infrastructure/persistence/prisma-inventory-report.reader';

import { AdjustmentsController } from './presentation/http/adjustments.controller';
import { GoodsReceiptsController } from './presentation/http/goods-receipts.controller';
import { InventoryCategoriesController } from './presentation/http/inventory-categories.controller';
import { InventoryItemsController } from './presentation/http/inventory-items.controller';
import { CatalogBrowseController } from './presentation/http/catalog-browse.controller';
import { InventorySuppliersController } from './presentation/http/inventory-suppliers.controller';
import { StockController } from './presentation/http/stock.controller';
import { ProcessesController } from './presentation/http/processes.controller';
import { ProcessRunsController } from './presentation/http/process-runs.controller';
import { RelatedItemsController } from './presentation/http/related-items.controller';
import { RecipesController } from './presentation/http/recipes.controller';
import { WriteOffsController } from './presentation/http/write-offs.controller';
import { InventoryLocationsController } from './presentation/http/locations.controller';
import { InventoryPolicyController } from './presentation/http/inventory-policy.controller';
import { LowStockAlertsController } from './presentation/http/low-stock-alerts.controller';
import { InventoryTransfersController } from './presentation/http/transfers.controller';
import { InventoryReportsController } from './presentation/http/inventory-reports.controller';

/**
 * Inventory (warehouse) module — raw + processed goods, FIFO/FEFO stock layers,
 * and an append-only movement ledger. Tenant-scoped by restaurantId. Reads
 * require inventory:read; writes are gated per action. Exposes the reusable
 * StockConsumptionPort to later contexts (orders/recipes, processes/write-offs).
 */
@Module({
  imports: [IdentityModule, PlatformCatalogModule],
  controllers: [
    InventoryItemsController,
    CatalogBrowseController,
    InventoryCategoriesController,
    InventorySuppliersController,
    GoodsReceiptsController,
    AdjustmentsController,
    StockController,
    ProcessesController,
    ProcessRunsController,
    RelatedItemsController,
    RecipesController,
    WriteOffsController,
    InventoryLocationsController,
    InventoryPolicyController,
    LowStockAlertsController,
    InventoryTransfersController,
    InventoryReportsController,
  ],
  providers: [
    // items
    ListInventoryItemsUseCase,
    GetInventoryItemUseCase,
    CreateInventoryItemUseCase,
    AdoptCatalogItemUseCase,
    UpdateInventoryItemUseCase,
    DeleteInventoryItemUseCase,
    SetItemConsumptionLocationUseCase,
    GetItemLayersUseCase,
    GetItemMovementsUseCase,
    // categories
    ListInventoryCategoriesUseCase,
    CreateInventoryCategoryUseCase,
    UpdateInventoryCategoryUseCase,
    DeleteInventoryCategoryUseCase,
    // suppliers
    ListSuppliersUseCase,
    CreateSupplierUseCase,
    UpdateSupplierUseCase,
    DeleteSupplierUseCase,
    // goods receipts
    CreateGoodsReceiptUseCase,
    ListGoodsReceiptsUseCase,
    GetGoodsReceiptUseCase,
    // adjustments
    CreateAdjustmentUseCase,
    ListAdjustmentsUseCase,
    // stock
    GetStockUseCase,
    // consumption core
    InventoryConsumptionService,
    // processes (INV-2)
    CreateProcessUseCase,
    UpdateProcessUseCase,
    DeleteProcessUseCase,
    RunProcessUseCase,
    ListProcessesUseCase,
    GetProcessUseCase,
    ListProcessRunsUseCase,
    GetProcessRunUseCase,
    GetRelatedItemsUseCase,
    ProcessDefinitionAssembler,
    ProcessGraphCycleChecker,
    ProducedItemGraphService,
    // recipes (INV-3)
    CreateRecipeUseCase,
    UpdateRecipeUseCase,
    DeleteRecipeUseCase,
    ListRecipesUseCase,
    GetRecipeUseCase,
    RecipeDefinitionAssembler,
    RecipeDetailAssembler,
    DishProjectionResolver,
    InventoryItemNameResolver,
    RecipeConsumptionService,
    OrderConsumptionListener,
    // write-offs (INV-4)
    CreateWriteOffUseCase,
    VoidWriteOffUseCase,
    ListWriteOffsUseCase,
    GetWriteOffUseCase,
    GetWriteOffSummaryUseCase,

    // multi-location inventory (6A)
    ListLocationsUseCase,
    CreateInventoryLocationUseCase,
    RenameInventoryLocationUseCase,
    DeleteInventoryLocationUseCase,
    GetLocationOnHandUseCase,
    SetCountedOnHandUseCase,
    GetBranchPolicyUseCase,
    UpdateBranchPolicyUseCase,
    ListLowStockAlertsUseCase,
    InventoryLocationProvisioner,
    NegativeStockPolicyService,

    // within-branch transfers (6B)
    CreateTransferUseCase,
    ListTransfersUseCase,
    GetTransferUseCase,

    // stock reports (6D)
    GetStockOnHandReportUseCase,
    GetValuationSummaryUseCase,
    GetLowStockReportUseCase,
    GetNegativeStockReportUseCase,
    GetMovementHistoryUseCase,
    InventoryReportScopeService,

    // port -> implementation bindings
    { provide: INVENTORY_ITEM_REPOSITORY, useClass: PrismaInventoryItemRepository },
    { provide: INVENTORY_CATEGORY_REPOSITORY, useClass: PrismaInventoryCategoryRepository },
    { provide: SUPPLIER_REPOSITORY, useClass: PrismaSupplierRepository },
    { provide: GOODS_RECEIPT_REPOSITORY, useClass: PrismaGoodsReceiptRepository },
    { provide: STOCK_LAYER_REPOSITORY, useClass: PrismaStockLayerRepository },
    { provide: STOCK_MOVEMENT_REPOSITORY, useClass: PrismaStockMovementRepository },
    { provide: INVENTORY_LEDGER_GATEWAY, useClass: PrismaInventoryLedgerGateway },
    { provide: INVENTORY_STOCK_READER, useClass: PrismaInventoryStockReader },
    { provide: STOCK_CONSUMPTION_PORT, useClass: InventoryConsumptionService },
    { provide: PROCESS_REPOSITORY, useClass: PrismaProcessRepository },
    { provide: PROCESS_RUN_REPOSITORY, useClass: PrismaProcessRunRepository },
    { provide: PROCESS_GRAPH_READER, useClass: PrismaProcessGraphReader },
    { provide: PROCESS_GRAPH_EDGES_READER, useClass: PrismaProcessGraphEdgesReader },
    { provide: PROCESS_RUN_DETAIL_READER, useClass: PrismaProcessRunDetailReader },
    { provide: RECIPE_REPOSITORY, useClass: PrismaRecipeRepository },
    { provide: MENU_ITEM_LOOKUP, useClass: PrismaMenuItemLookup },
    { provide: ITEM_UNIT_COST_READER, useClass: PrismaItemUnitCostReader },
    { provide: ITEM_RESOLUTION_READER, useClass: PrismaItemResolutionReader },
    { provide: WRITE_OFF_REPOSITORY, useClass: PrismaWriteOffRepository },
    { provide: WRITE_OFF_SUMMARY_READER, useClass: PrismaWriteOffSummaryReader },
    { provide: INVENTORY_LOCATION_REPOSITORY, useClass: PrismaInventoryLocationRepository },
    { provide: BRANCH_INVENTORY_POLICY_REPOSITORY, useClass: PrismaBranchInventoryPolicyRepository },
    { provide: STOCK_ON_HAND_READER, useClass: PrismaStockOnHandReader },
    { provide: LOW_STOCK_ALERT_READER, useClass: PrismaLowStockAlertReader },
    { provide: INVENTORY_TRANSFER_REPOSITORY, useClass: PrismaInventoryTransferRepository },
    { provide: INVENTORY_REPORT_READER, useClass: PrismaInventoryReportReader },
  ],
  // Later contexts depend on the consumption PORT, not the concrete service.
  exports: [STOCK_CONSUMPTION_PORT],
})
export class InventoryModule {}
