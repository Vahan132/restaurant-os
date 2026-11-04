import { CustomerAccount } from '../../domain/entities/customer-account';

/** Profile shape returned by GET/PATCH /consumer/me. */
export interface ConsumerProfileView {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  /** ISO date (YYYY-MM-DD) or null. */
  birthday: string | null;
}

export function toProfileView(account: CustomerAccount): ConsumerProfileView {
  const p = account.toPrimitives();
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    gender: p.gender,
    birthday: p.birthday ? p.birthday.toISOString().slice(0, 10) : null,
  };
}
