/** DI token for the IdGenerator port. */
export const ID_GENERATOR = Symbol('IdGenerator');

/**
 * IdGenerator port — produces cuid-style ids. Implemented in infrastructure.
 * Keeps the domain pure: aggregates receive their id at creation time rather
 * than depending on the database or an id library directly.
 */
export interface IdGenerator {
  generate(): string;
}
