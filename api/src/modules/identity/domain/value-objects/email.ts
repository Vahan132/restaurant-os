import { ValueObject } from '../../../../shared/domain/value-object';
import { InvalidEmailError } from '../identity.errors';

interface EmailProps {
  value: string;
}

// Pragmatic RFC-5322-ish check; deeper validation belongs at the edge (DTOs).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Email value object. Normalizes to lower-case and validates format. */
export class Email extends ValueObject<EmailProps> {
  private constructor(props: EmailProps) {
    super(props);
  }

  static create(raw: string): Email {
    const value = raw.trim().toLowerCase();
    if (!EMAIL_REGEX.test(value)) {
      throw new InvalidEmailError(raw);
    }
    return new Email({ value });
  }

  get value(): string {
    return this.props.value;
  }

  override toString(): string {
    return this.props.value;
  }
}
