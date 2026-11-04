-- Activity-Log Filtered View (Prompt 2A): make the employee activity log
-- branch-aware and role-aware so the filtered list view + CSV export can scope
-- by branch (with explicit isolation) and filter by the actor's role.

-- Branch the audited action occurred in. Nullable: restaurant/org-level actions
-- (user created, subscription changed, ...) have no branch context, and existing
-- rows pre-date branch capture.
ALTER TABLE "audit_logs" ADD COLUMN "branchId" TEXT;

-- Snapshot of the actor's role CODE at action time (OWNER/MANAGER/WAITER/...).
-- Nullable: SYSTEM/PLATFORM actors and custom (non-system) roles have none.
ALTER TABLE "audit_logs" ADD COLUMN "actorRoleCode" TEXT;

-- Supporting indexes for the filtered view: branch-scoped reads and action-type
-- filtering, both newest-first within a restaurant.
CREATE INDEX "audit_logs_restaurantId_branchId_createdAt_idx" ON "audit_logs" ("restaurantId", "branchId", "createdAt");
CREATE INDEX "audit_logs_restaurantId_action_createdAt_idx" ON "audit_logs" ("restaurantId", "action", "createdAt");
