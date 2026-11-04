import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  ConsumerGender,
  CustomerAccount,
} from '../../domain/entities/customer-account';
import { CustomerAccountRepository } from '../../domain/repositories/customer-account.repository';

interface AccountRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  birthday: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PrismaCustomerAccountRepository implements CustomerAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<CustomerAccount | null> {
    return this.toAggregate(await this.prisma.customerAccount.findUnique({ where: { id } }));
  }

  async findByEmail(email: string): Promise<CustomerAccount | null> {
    return this.toAggregate(await this.prisma.customerAccount.findUnique({ where: { email } }));
  }

  async findByPhone(phone: string): Promise<CustomerAccount | null> {
    return this.toAggregate(await this.prisma.customerAccount.findUnique({ where: { phone } }));
  }

  async save(account: CustomerAccount): Promise<void> {
    const p = account.toPrimitives();
    const data = {
      name: p.name,
      email: p.email,
      phone: p.phone,
      gender: p.gender as ConsumerGender | null,
      birthday: p.birthday,
    };
    await this.prisma.customerAccount.upsert({
      where: { id: p.id },
      create: { id: p.id, ...data },
      update: data,
    });
  }

  async hardDelete(id: string): Promise<void> {
    await this.prisma.customerAccount.delete({ where: { id } });
  }

  private toAggregate(row: AccountRow | null): CustomerAccount | null {
    if (!row) return null;
    return CustomerAccount.fromPersistence(row.id, {
      name: row.name,
      email: row.email,
      phone: row.phone,
      gender: row.gender as ConsumerGender | null,
      birthday: row.birthday,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
