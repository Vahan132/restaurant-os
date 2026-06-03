import { ValueObject } from '../../../../shared/domain/value-object';
import { InvalidPasswordHashError } from '../identity.errors';

interface PasswordHashProps {
  value: string;
}

/**
 * PasswordHash value object — wraps an already-hashed password string.
 * The domain never sees or stores raw passwords; hashing is an infrastructure
 * concern (PasswordHasher port).
 */
export class PasswordHash extends ValueObject<PasswordHashProps> {
  private constructor(props: PasswordHashProps) {
    super(props);
  }

  /** Wrap a hash produced by a PasswordHasher. */
  static fromHash(hash: string): PasswordHash {
    if (typeof hash !== 'string' || hash.trim().length === 0) {
      throw new InvalidPasswordHashError();
    }
    return new PasswordHash({ value: hash });
  }

  get value(): string {
    return this.props.value;
  }

  override toString(): string {
    return this.props.value;
  }
}
