import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  ConsumerProfileContact,
  ConsumerProfileReader,
} from '../../domain/repositories/consumer-profile.reader';

@Injectable()
export class PrismaConsumerProfileReader implements ConsumerProfileReader {
  constructor(private readonly prisma: PrismaService) {}

  async getContact(customerAccountId: string): Promise<ConsumerProfileContact | null> {
    const account = await this.prisma.customerAccount.findUnique({
      where: { id: customerAccountId },
      select: { name: true, phone: true },
    });
    return account ? { name: account.name, phone: account.phone } : null;
  }
}
