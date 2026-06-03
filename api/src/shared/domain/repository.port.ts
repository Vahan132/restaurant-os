/**
 * Generic repository port. Pure domain — no framework imports.
 *
 * Concrete repository ports live in each module's `domain/repositories` folder
 * and may extend this interface. Implementations live in `infrastructure` and
 * are bound to DI tokens (see MODULE_TEMPLATE.md).
 */
export interface RepositoryPort<TEntity, TId = string> {
  findById(id: TId): Promise<TEntity | null>;
  save(entity: TEntity): Promise<void>;
  delete(id: TId): Promise<void>;
}
