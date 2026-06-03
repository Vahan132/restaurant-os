# modules/

Each bounded context lives in its own folder here and follows the canonical
DDD layout documented in [`MODULE_TEMPLATE.md`](./MODULE_TEMPLATE.md).

Prompt 1 ships only the `health/` example module (presentation-only) to
demonstrate the structure. Real domain modules (auth, menu, orders, …) are added
from prompt 2 onward and **must** follow the template — including the repository
port/adapter split and tenant scoping described in `CONVENTIONS.md`.

Dependency rule (enforced): `presentation -> application -> domain`, with
`infrastructure` implementing domain ports. The `domain/` layer never imports
NestJS, Prisma, or any framework (ESLint enforces this — see `.eslintrc.cjs`).
