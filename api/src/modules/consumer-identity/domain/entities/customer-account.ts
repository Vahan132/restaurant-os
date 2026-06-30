import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { E164Phone } from '../value-objects/e164-phone';

export type ConsumerGender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNDISCLOSED';

export interface CustomerAccountProps {
  name: string | null;
  email: string | null;
  phone: string | null;
  gender: ConsumerGender | null;
  birthday: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * CustomerAccount aggregate (pure domain).
 *
 * Invariants enforced here:
 *  - `phone`, when set, is canonical E.164 (validated via E164Phone).
 *  - profile edits touch only name/gender/birthday; email is provider-owned and is
 *    never mutated through the aggregate (the use-case rejects email changes with
 *    EMAIL_IMMUTABLE — defence in depth: there is simply no email setter here).
 */
export class CustomerAccount extends AggregateRoot<string> {
  private constructor(
    id: string,
    private props: CustomerAccountProps,
  ) {
    super(id);
  }

  /** New account. `phone` is normalized/validated when provided. */
  static create(input: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    gender?: ConsumerGender | null;
    birthday?: Date | null;
    now?: Date;
  }): CustomerAccount {
    const now = input.now ?? new Date();
    return new CustomerAccount(input.id, {
      name: input.name ?? null,
      email: input.email ?? null,
      phone: input.phone ? E164Phone.normalizeOrThrow(input.phone) : null,
      gender: input.gender ?? null,
      birthday: input.birthday ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Rehydrate from persistence without re-running creation side effects. */
  static fromPersistence(id: string, props: CustomerAccountProps): CustomerAccount {
    return new CustomerAccount(id, { ...props });
  }

  get name(): string | null {
    return this.props.name;
  }
  get email(): string | null {
    return this.props.email;
  }
  get phone(): string | null {
    return this.props.phone;
  }
  get gender(): ConsumerGender | null {
    return this.props.gender;
  }
  get birthday(): Date | null {
    return this.props.birthday;
  }

  /** Edit freely-editable profile fields. `undefined` = leave unchanged. */
  updateProfile(patch: {
    name?: string | null;
    gender?: ConsumerGender | null;
    birthday?: Date | null;
  }): void {
    if (patch.name !== undefined) this.props.name = patch.name;
    if (patch.gender !== undefined) this.props.gender = patch.gender;
    if (patch.birthday !== undefined) this.props.birthday = patch.birthday;
    this.touch();
  }

  /** Set the verified phone (E.164). Used after OTP confirmation. */
  setPhone(phone: string): void {
    this.props.phone = E164Phone.normalizeOrThrow(phone);
    this.touch();
  }

  /** Capture provider name/email on first auth if currently absent (Apple first-auth). */
  fillMissingFromProvider(input: { name?: string | null; email?: string | null }): void {
    if (!this.props.name && input.name) this.props.name = input.name;
    if (!this.props.email && input.email) this.props.email = input.email;
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  toPrimitives(): { id: string } & CustomerAccountProps {
    return { id: this.id, ...this.props };
  }
}
