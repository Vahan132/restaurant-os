import { ValueObject } from '../../../../shared/domain/value-object';
import { WeakPasswordError } from '../identity.errors';

interface RawPasswordProps {
  value: string;
}

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

/**
 * RawPassword value object — validates strength of a plaintext password BEFORE
 * it is handed to the PasswordHasher. The plaintext is never persisted and
 * never leaves the application boundary.
 */
export class RawPassword extends ValueObject<RawPasswordProps> {
  private constructor(props: RawPasswordProps) {
    super(props);
  }

  static create(raw: string): RawPassword {
    if (typeof raw !== 'string') {
      throw new WeakPasswordError();
    }
    if (raw.length < MIN_PASSWORD_LENGTH) {
      throw new WeakPasswordError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
      );
    }
    if (raw.length > MAX_PASSWORD_LENGTH) {
      throw new WeakPasswordError(
        `Password must be at most ${MAX_PASSWORD_LENGTH} characters long.`,
      );
    }
    // Require some variety: at least one letter and one digit.
    if (!/[A-Za-z]/.test(raw) || !/\d/.test(raw)) {
      throw new WeakPasswordError('Password must contain at least one letter and one number.');
    }
    return new RawPassword({ value: raw });
  }

  get value(): string {
    return this.props.value;
  }
}
