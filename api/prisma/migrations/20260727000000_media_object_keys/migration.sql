-- MEDIA-1: object-storage keys for uploaded images (additive, nullable, safe on
-- existing rows). The existing URL columns stay and keep working (URL-paste);
-- when a key is present it is the authoritative reference and the URL column
-- holds the resolved public URL.

ALTER TABLE "menu_items" ADD COLUMN "image_key" TEXT;
ALTER TABLE "restaurant_settings" ADD COLUMN "logo_key" TEXT;
ALTER TABLE "consumer_restaurant_photos" ADD COLUMN "object_key" TEXT;
