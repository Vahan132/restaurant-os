# BR-7 — Web Admin multi-branch: implementation notes

Branch switcher + branch context, branch management, per-branch staff access,
and catalog import/export/clone. Built on the A1 foundation and existing
app-shell / table / form / drawer patterns — no new design language.

## ⚠️ Important: API codegen could not be run in this environment

The spec says to run `pnpm generate:api` after BR-1–6. In the environment where
this was implemented the live backend swagger was unreachable and the local
`openapi.json` predated BR-1–6 (and was truncated), so `orval` could not be run
without destroying the existing generated client.

To keep the app compiling and the hook call-sites correct, the BR-1–6 endpoints
were added as **hand-authored generated-style modules** that match the
operationId-derived names a real `generate:api` will emit. They live alongside
the real generated client and are clearly marked. **Re-run codegen against the
post-BR-1–6 backend** to replace them:

```bash
ORVAL_INPUT=http://localhost:3001/docs-json pnpm generate:api
```

For that to be drop-in, the backend should expose these operations/schemas
(adjust names on either side to match):

| Module (tag)          | Operation / route                                              |
|-----------------------|---------------------------------------------------------------|
| `branches`            | `BranchAdminController_list`        `GET    /branches`         |
|                       | `BranchAdminController_create`      `POST   /branches`         |
|                       | `BranchAdminController_update`      `PATCH  /branches/{id}`    |
|                       | `BranchAdminController_disable`     `POST   /branches/{id}/disable` |
|                       | `BranchAdminController_makeDefault` `POST   /branches/{id}/make-default` |
| `branch-memberships`  | `BranchMembershipsController_list`   `GET    /users/{userId}/branch-memberships` |
|                       | `BranchMembershipsController_create` `POST   /users/{userId}/branch-memberships` |
|                       | `BranchMembershipsController_remove` `DELETE /users/{userId}/branch-memberships/{branchId}` |
| `catalog`             | `CatalogController_export`    `POST /branches/{branchId}/catalog/export` |
|                       | `CatalogController_import`    `POST /branches/{branchId}/catalog/import` |
|                       | `CatalogController_cloneFrom` `POST /branches/{branchId}/catalog/clone-from/{sourceBranchId}` |

Schemas added: `BranchAdminResponse` (+ `isDefault`), `UpdateBranchAdminDto`,
`BranchMembershipResponse`, `CreateBranchMembershipDto`, `CatalogSectionsDto`,
`CatalogExportDto`, `CatalogBundleResponse`, `CatalogImportDto`,
`CatalogCloneDto`, `CatalogConflictStrategy` (SKIP|OVERWRITE), `CatalogImportMode`
(DRY_RUN|APPLY), `CatalogImportError`, `CatalogSectionReport`,
`CatalogImportReportResponse`.

The extended **`GET /auth/me`** (BR-1) is consumed in `src/lib/auth/auth-service.ts`
and is expected to add: `accessibleBranches: [{ id, name, isDefault, status }]`,
`defaultBranchId`, and `branchPermissions: { [branchId]: string[] }`.

## Routes / sections touched

New routes:
- `/branches` — branch management (gated `BRANCH_MANAGE`, restaurant-wide).
- `/catalog-tools` — import / export / clone (gated by catalog perms at the active branch).

New top-bar control: **branch switcher** (all screens).

Branch-aware permissions now drive every branch-scoped screen (menu, inventory,
orders, tables, KDS, reservations, dashboard, reports). Restaurant-level screens
(branches, users, settings, audit) resolve permissions restaurant-wide.

### Files added
- `src/stores/active-branch.ts` — persisted `{ activeBranchId }`.
- `src/lib/branch/branch-queries.ts` — branch-scoped query invalidation.
- `src/lib/branch/use-branch-context.ts` — accessible branches + active selection.
- `src/lib/branch/use-branches-admin.ts` — branch list + invalidation (refreshes `/auth/me`).
- `src/components/shell/branch-switcher.tsx`, `branch-sync.tsx`.
- `src/components/branches/branch-management.tsx`, `branch-form-modal.tsx`.
- `src/app/(app)/branches/page.tsx`.
- `src/components/users/branch-memberships-editor.tsx`.
- `src/components/catalog/*` — `catalog-tools`, `export-panel`, `import-panel`,
  `clone-panel`, `import-report`, `include-filters`.
- `src/lib/catalog/*` — `download`, `xlsx` (dependency-free `.xls` of item+price
  lists), `use-catalog-refetch`.
- `src/app/(app)/catalog-tools/page.tsx`.
- `src/api/generated/{branches,branch-memberships,catalog}/*` and matching
  `src/api/generated/model/*` (BR-1–6 stand-ins; see above).

### Files changed
- `src/api/mutator.ts` — attaches `X-Branch-Id` on every authed request.
- `src/stores/auth.ts` — per-branch permissions, accessible branches, default branch.
- `src/lib/auth/auth-service.ts` — parses extended `/auth/me`, initialises the
  active branch (constrained to accessible branches), clears it on logout.
- `src/lib/auth/use-permission.ts` + `src/components/auth/can.tsx` — `scope`
  (`branch` default | `restaurant`) resolution.
- `src/components/shell/{nav-config.ts,sidebar.tsx,topbar.tsx,app-shell.tsx}`.
- `src/components/users/{users-manager.tsx,user-form-modal.tsx}` — access model
  (All branches vs Specific branches).
- `src/components/settings/settings-manager.tsx` — restaurant-scope gate.
- `src/lib/permissions.ts` — adds `BRANCH_MANAGE`.
- `messages/{en,ru,hy}.json` — new `branch` / `catalog` namespaces, nav + users keys.

## Run steps

```bash
ORVAL_INPUT=http://localhost:3001/docs-json pnpm generate:api   # after BR-1–6
pnpm lint
pnpm typecheck
pnpm dev    # http://localhost:4001
```

## Verification done here
- `tsc` (focused): active-branch store, auth store, branch-aware permissions,
  `X-Branch-Id` mutator, branch invalidation, `/auth/me` reconciliation — **pass**.
- `tsc` (focused): the three generated stand-in API modules — **pass**.
- Syntax-check (transpile) of every new component + the edited user editor — **pass**.
- `messages/{en,ru,hy}.json` parse as valid JSON with matching keys.

A full-project `pnpm typecheck && pnpm lint` should be run in your environment
(the sandbox could not read the full hydrated tree).
