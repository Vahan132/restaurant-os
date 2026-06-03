# Module template (canonical DDD layout)

Every bounded context under `src/modules/` follows this structure. Replace
`<context>` with the module name (e.g. `menu`, `orders`, `auth`).

```
modules/<context>/
├─ domain/
│  ├─ entities/                # or aggregates/  — entities & aggregate roots (pure)
│  ├─ value-objects/           # value objects (pure)
│  ├─ events/                  # domain events (pure)
│  └─ repositories/            # repository PORTS (interfaces) + DI tokens
├─ application/
│  ├─ commands/                # write use cases (one responsibility each)
│  ├─ queries/                 # read use cases
│  ├─ dto/                     # request/response DTOs (class-validator)
│  └─ services/                # use-case classes / orchestration
├─ infrastructure/
│  └─ persistence/             # Prisma repo IMPLEMENTATIONS + mappers
├─ presentation/
│  └─ http/                    # controllers
└─ <context>.module.ts         # wires providers, binds ports -> impls
```

## Rules

1. **Dependency direction (inward only):**
   `presentation -> application -> domain`. `infrastructure` depends on
   `domain` (it implements its ports). The `domain/` layer imports **no**
   framework code — no NestJS, no Prisma, no `class-validator`. This is
   enforced by ESLint (`src/**/domain/**` has restricted imports).

2. **Repository ports & adapters:**
   - Define a port interface in `domain/repositories/`, e.g.
     `menu-item.repository.ts` exporting `MenuItemRepository` plus a DI token:
     ```ts
     export const MENU_ITEM_REPOSITORY = Symbol('MenuItemRepository');
     export interface MenuItemRepository extends RepositoryPort<MenuItem> { /* ... */ }
     ```
   - Implement it in `infrastructure/persistence/`, e.g.
     `prisma-menu-item.repository.ts`, mapping Prisma records <-> domain
     entities via a mapper in the same folder.
   - Bind in `<context>.module.ts`:
     ```ts
     providers: [
       { provide: MENU_ITEM_REPOSITORY, useClass: PrismaMenuItemRepository },
       CreateMenuItem, // use case
     ]
     ```
   - Inject by token: `@Inject(MENU_ITEM_REPOSITORY) private readonly repo: MenuItemRepository`.

3. **Application services = use cases.** One class per use case implementing
   `UseCase<Input, Output>` from `@shared/application/use-case`. Group writes in
   `commands/`, reads in `queries/`. `@nestjs/cqrs` is optional and not used yet.

4. **Domain events.** Aggregates extend `AggregateRoot` and `addDomainEvent(...)`
   as state changes. After persistence, the use case calls
   `DomainEventPublisher.publishFromAggregate(aggregate)`. Listeners subscribe
   with `@OnEvent('<context>.<event>')`.

5. **Tenancy.** Operational entities carry `restaurantId` (required) and
   `branchId` (optional), are indexed, and are filtered by the request's
   `TenantContext` on every query. Read the tenant via `@CurrentTenant()`; never
   trust a client-supplied tenant id. See `CONVENTIONS.md`.

6. **Conventions.** Apply the success envelope, error shape, pagination, cuid
   ids, timestamps, soft delete, and money rules from `CONVENTIONS.md`.

## Minimal example (`health/`)

`health/` is a presentation-only module (no domain/application/infrastructure):

```
modules/health/
├─ presentation/http/health.controller.ts   # GET /health
└─ health.module.ts
```
