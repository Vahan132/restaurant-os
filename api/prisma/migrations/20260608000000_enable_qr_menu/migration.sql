-- Storefront: per-restaurant public QR menu toggle.
-- The DEFAULT true backfills every existing settings row (idempotent).

-- AlterTable
ALTER TABLE "restaurant_settings" ADD COLUMN "enableQrMenu" BOOLEAN NOT NULL DEFAULT true;
