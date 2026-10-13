-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "additional_discount" INTEGER,
ADD COLUMN     "additional_discount_type" INTEGER,
ADD COLUMN     "adg_code" TEXT,
ADD COLUMN     "dep" TEXT,
ADD COLUMN     "discount" INTEGER,
ADD COLUMN     "emarks" TEXT,
ADD COLUMN     "good_code" TEXT,
ADD COLUMN     "good_name" TEXT,
ADD COLUMN     "line_discount_type" INTEGER,
ADD COLUMN     "unit" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "card_amount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cash_amount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "change_amount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fiscal_number" TEXT,
ADD COLUMN     "fiscal_qr" TEXT,
ADD COLUMN     "fiscal_receipt_id" TEXT,
ADD COLUMN     "fiscalized_at" TIMESTAMP(3),
ADD COLUMN     "partial_amount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "partner_tin" TEXT,
ADD COLUMN     "payment_reference" TEXT,
ADD COLUMN     "prepayment_amount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "waiterId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "processedByUserId" DROP NOT NULL;
