/**
 * Base class for domain errors (pure — no framework imports).
 *
 * Domain code throws these to signal broken invariants/validation. The shared
 * DomainExceptionFilter maps them to the standard HTTP error shape using
 * `code` (UPPER_SNAKE) and `httpStatus`. Every module reuses this base.
 */
export abstract class DomainError extends Error {
  /** Stable UPPER_SNAKE error code surfaced to clients. */
  abstract readonly code: string;
  /** HTTP status the presentation layer should respond with. */
  readonly httpStatus: number = 400;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
