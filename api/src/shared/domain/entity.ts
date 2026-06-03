/**
 * Base Entity. Pure domain — no framework imports.
 *
 * Entities have identity: two entities are equal when they share the same id
 * (and the same concrete type), regardless of their other attributes.
 */
export abstract class Entity<TId = string> {
  protected readonly _id: TId;

  protected constructor(id: TId) {
    this._id = id;
  }

  get id(): TId {
    return this._id;
  }

  /** Identity-based equality. */
  public equals(other?: Entity<TId>): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    if (this === other) {
      return true;
    }
    if (this.constructor !== other.constructor) {
      return false;
    }
    return this._id === other._id;
  }
}
