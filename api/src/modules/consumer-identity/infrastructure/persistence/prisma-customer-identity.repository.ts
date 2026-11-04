import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  CustomerIdentityRecord,
  CustomerIdentityRepository,
  IdentityProvider,
} from '../../domain/repositories/customer-identity.repository';

@Injectable()
export class PrismaCustomerIdentityRepository implements CustomerIdentityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByProviderSubject(
    provider: IdentityProvider,
    subject: string,
  ): Promise<CustomerIdentityRecord | null> {
    const r = await this.prisma.customerIdentity.findUnique({
      where: { provider_subject: { provider, subject } },
    });
    return r ? this.map(r) : null;
  }

  async findByAccountAndProvider(
    customerAccountId: string,
    provider: IdentityProvider,
  ): Promise<CustomerIdentityRecord | null> {
    const r = await this.prisma.customerIdentity.findFirst({
      where: { customerAccountId, provider },
    });
    return r ? this.map(r) : null;
  }

  async create(input: {
    customerAccountId: string;
    provider: IdentityProvider;
    subject: string;
    emailVerified: boolean;
  }): Promise<void> {
    await this.prisma.customerIdentity.create({ data: input });
  }

  async updateSubject(id: string, subject: string): Promise<void> {
    await this.prisma.customerIdentity.update({ where: { id }, data: { subject } });
  }

  private map(r: {
    id: string;
    customerAccountId: string;
    provider: string;
    subject: string;
    emailVerified: boolean;
  }): CustomerIdentityRecord {
    return {
      id: r.id,
      customerAccountId: r.customerAccountId,
      provider: r.provider as IdentityProvider,
      subject: r.subject,
      emailVerified: r.emailVerified,
    };
  }
}
