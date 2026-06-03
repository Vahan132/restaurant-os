# Restaurant OS — Backend Conventions

These conventions are codified in the shared kernel and enforced by ESLint /
the Prisma schema. Every module follows them.

## API responses

### Success envelope

- **Single resource:** returned as-is (the plain object).
- **Lists:** wrapped by `ResponseEnvelopeInterceptor` into:

  ```json
  {
    "data": [ /* items */ ],
    "pagination": { "page": 1, "limit": 20, "total": 57, "totalPages": 3 }
  }
  ```

Controllers return **plain data**. For real lists, build the result with the
`paginate()` helper in `@shared/application/pagination` so `total`/`totalPages`
are accurate; a bare array is also wrapped (with best-effort metadata).

### Error shape

Every error is normalized by `AllExceptionsFilter` into:

```json
{ "error": { "code": "UPPER_SNAKE", "message": "human readable", "details": {} } }
```

with the correct HTTP status. `details` is optional (e.g. validation messages).
Validation failures use code `VALIDATION_ERROR`.

## Pagination

Query params: `?page` (default `1`) and `?limit` (default `20`, **max `100`**).
Use `normalizePagination()` / `toSkipTake()` from
`@shared/application/pagination`.

## Persistence conventions

- **IDs:** `cuid` (`@default(cuid())`).
- **Timestamps:** `createdAt` + `updatedAt` on **every** model.
- **Soft delete:** `deletedAt?` for catalog/config entities; queries must filter
  out soft-deleted rows by default.
- **Money:** integers in **minor units** (e.g. cents). Domain/DTO money fields
  end in `_amount`; Prisma columns are mapped to `..._amount` (e.g. `priceAmount`
  -> column `price_amount`). Currency is **per-restaurant**; a Plan carries its
  own currency for billing.

## Multi-tenancy

Hierarchy: **Organization** (billing/account) → **Restaurant** (operations) →
**Branch** (location).

- `organizationId` = account key (billing, subscription, plan limits).
- `restaurantId` = operations key. **Every operational entity** carries
  `restaurantId` (required) + `branchId` (nullable), both indexed, and is
  tenant-scoped on every query.
- The server **never trusts client-supplied tenant ids**. The `TenantContext` is
  derived from a verified JWT (authenticated surfaces) or from host resolution
  (public surfaces) — see `TenantResolverService`. Read it via `@CurrentTenant()`.

## DDD dependency rule

Dependencies point **inward** only:

```
presentation -> application -> domain
infrastructure -> domain        (implements its ports)
```

The `domain/` layer is **pure**: no NestJS, no Prisma, no `class-validator`, no
framework imports. This is enforced by ESLint (`src/**/domain/**` has
`no-restricted-imports`). Repository **ports** live in `domain/repositories`;
their Prisma **implementations** live in `infrastructure/persistence` and are
bound to DI tokens. See `src/modules/MODULE_TEMPLATE.md`.

## Domain events

Aggregates extend `AggregateRoot` and collect events via `addDomainEvent`.
After the aggregate is persisted, the use case calls
`DomainEventPublisher.publishFromAggregate(aggregate)`, which dispatches over
`@nestjs/event-emitter`. Listeners use `@OnEvent('<context>.<event>')` (used by
audit logs / KDS in later prompts).
