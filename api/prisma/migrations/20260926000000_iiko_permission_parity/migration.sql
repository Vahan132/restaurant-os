-- IIKO-PERM-1: finer-grained permissions modelled on iiko role rights.
--
-- Every new key SPLITS an existing, broader permission. To keep behaviour
-- unchanged, each new key is granted to EVERY role (system and custom) that
-- already holds its parent. Admins can then remove the finer right from a role.
-- Additive and idempotent (safe to re-run).

-- order:edit_others <- ORDER_EDIT
UPDATE "roles"
SET "permissions" = array_append("permissions", 'order:edit_others')
WHERE 'ORDER_EDIT' = ANY("permissions")
  AND NOT ('order:edit_others' = ANY("permissions"));

-- order:move_table <- ORDER_EDIT
UPDATE "roles"
SET "permissions" = array_append("permissions", 'order:move_table')
WHERE 'ORDER_EDIT' = ANY("permissions")
  AND NOT ('order:move_table' = ANY("permissions"));

-- payment:void <- PAYMENT_PROCESS
UPDATE "roles"
SET "permissions" = array_append("permissions", 'payment:void')
WHERE 'PAYMENT_PROCESS' = ANY("permissions")
  AND NOT ('payment:void' = ANY("permissions"));

-- fiscal:receipt:print <- PAYMENT_PROCESS
UPDATE "roles"
SET "permissions" = array_append("permissions", 'fiscal:receipt:print')
WHERE 'PAYMENT_PROCESS' = ANY("permissions")
  AND NOT ('fiscal:receipt:print' = ANY("permissions"));

-- menu:stop_list <- MENU_MANAGE
UPDATE "roles"
SET "permissions" = array_append("permissions", 'menu:stop_list')
WHERE 'MENU_MANAGE' = ANY("permissions")
  AND NOT ('menu:stop_list' = ANY("permissions"));

-- reports:profit:view <- REPORTS_VIEW
UPDATE "roles"
SET "permissions" = array_append("permissions", 'reports:profit:view')
WHERE 'REPORTS_VIEW' = ANY("permissions")
  AND NOT ('reports:profit:view' = ANY("permissions"));

-- finance:expense:read <- inventory:read
UPDATE "roles"
SET "permissions" = array_append("permissions", 'finance:expense:read')
WHERE 'inventory:read' = ANY("permissions")
  AND NOT ('finance:expense:read' = ANY("permissions"));

-- finance:expense:manage <- inventory:writeoff:create
UPDATE "roles"
SET "permissions" = array_append("permissions", 'finance:expense:manage')
WHERE 'inventory:writeoff:create' = ANY("permissions")
  AND NOT ('finance:expense:manage' = ANY("permissions"));

-- finance:expense:delete <- inventory:writeoff:void
UPDATE "roles"
SET "permissions" = array_append("permissions", 'finance:expense:delete')
WHERE 'inventory:writeoff:void' = ANY("permissions")
  AND NOT ('finance:expense:delete' = ANY("permissions"));

-- user:view <- USER_MANAGE
UPDATE "roles"
SET "permissions" = array_append("permissions", 'user:view')
WHERE 'USER_MANAGE' = ANY("permissions")
  AND NOT ('user:view' = ANY("permissions"));

-- inventory:supplier:manage <- inventory:item:manage
UPDATE "roles"
SET "permissions" = array_append("permissions", 'inventory:supplier:manage')
WHERE 'inventory:item:manage' = ANY("permissions")
  AND NOT ('inventory:supplier:manage' = ANY("permissions"));

-- Kitchen leads maintain the stop-list (iiko F_EM) — matches SYSTEM_ROLE_PERMISSIONS.
UPDATE "roles"
SET "permissions" = array_append("permissions", 'menu:stop_list')
WHERE "isSystem" = true
  AND "code" IN ('CHEF', 'SOUS_CHEF')
  AND NOT ('menu:stop_list' = ANY("permissions"));
