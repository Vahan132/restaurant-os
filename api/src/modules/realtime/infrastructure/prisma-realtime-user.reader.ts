import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { RealtimeUserReader } from '../application/ports/realtime-user.reader';

/** Checks the user is ACTIVE and not soft-deleted (tenant token validity at WS connect). */
@Injectable()
export class PrismaRealtimeUserReader implements RealtimeUserReader {
  constructor(private readonly prisma: PrismaService) {}

  async isActiveUser(organizationId: string, userId: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
    });
    return !!user && user.status === 'ACTIVE' && user.deletedAt === null;
  }
}
