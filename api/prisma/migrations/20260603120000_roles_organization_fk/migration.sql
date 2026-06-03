-- Adds the Role -> Organization foreign key that was missing from
-- 20260530000000_add_identity (the roles table + index were created there, but
-- this FK constraint was omitted, causing permanent schema drift). Additive and
-- safe to apply on top of an existing database.
ALTER TABLE "roles" ADD CONSTRAINT "roles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
