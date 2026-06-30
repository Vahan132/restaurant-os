import { CustomerAccount } from '../entities/customer-account';

export const CUSTOMER_ACCOUNT_REPOSITORY = Symbol('CustomerAccountRepository');

export interface CustomerAccountRepository {
  findById(id: string): Promise<CustomerAccount | null>;
  /** Find by exact email (provider-verified email linking). Null if none. */
  findByEmail(email: string): Promise<CustomerAccount | null>;
  /** Find by exact E.164 phone. Null if none. */
  findByPhone(phone: string): Promise<CustomerAccount | null>;
  /** Insert or update the aggregate. */
  save(account: CustomerAccount): Promise<void>;
  /** Hard-delete the account row (cascades identities + refresh tokens). */
  hardDelete(id: string): Promise<void>;
}
