-- C2a: customer dine-in ordering as staff-confirmed REQUESTS.

-- AlterTable (opt-in; backfills existing rows via the default)
ALTER TABLE "restaurant_settings" ADD COLUMN "enableCustomerOrdering" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "CustomerOrderRequestStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "customer_order_requests" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "customerName" TEXT,
    "note" TEXT,
    "status" "CustomerOrderRequestStatus" NOT NULL DEFAULT 'PENDING',
    "linkedOrderId" TEXT,
    "rejectedReason" TEXT,
    "handledByUserId" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_order_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_order_request_items" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "unitPriceAmount" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "lineTotalAmount" INTEGER NOT NULL,

    CONSTRAINT "customer_order_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_order_request_item_modifiers" (
    "id" TEXT NOT NULL,
    "requestItemId" TEXT NOT NULL,
    "modifierGroupId" TEXT,
    "modifierOptionId" TEXT,
    "nameSnapshot" TEXT NOT NULL,
    "priceDeltaAmount" INTEGER NOT NULL,

    CONSTRAINT "customer_order_request_item_modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_order_requests_restaurantId_status_idx" ON "customer_order_requests"("restaurantId", "status");
CREATE INDEX "customer_order_requests_tableId_idx" ON "customer_order_requests"("tableId");
CREATE INDEX "customer_order_request_items_requestId_idx" ON "customer_order_request_items"("requestId");
CREATE INDEX "customer_order_request_item_modifiers_requestItemId_idx" ON "customer_order_request_item_modifiers"("requestItemId");

-- AddForeignKey
ALTER TABLE "customer_order_requests" ADD CONSTRAINT "customer_order_requests_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_order_requests" ADD CONSTRAINT "customer_order_requests_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "restaurant_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_order_request_items" ADD CONSTRAINT "customer_order_request_items_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "customer_order_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_order_request_item_modifiers" ADD CONSTRAINT "customer_order_request_item_modifiers_requestItemId_fkey" FOREIGN KEY ("requestItemId") REFERENCES "customer_order_request_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
