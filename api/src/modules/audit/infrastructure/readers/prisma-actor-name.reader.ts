import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { ActorNameReader } from '../../application/ports/actor-name.reader';
import { AuditActorType } from '../../domain/enums';

/** Resolves actor display names from the user / platform-user tables (best-effort). */
@Injectable()
export class PrismaActorNameReader implements ActorNameReader {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(actorType: AuditActorType, actorId: string | null): Promise<string | null> {
    if (!actorId) {
      return null;
    }
    if (actorType === AuditActorType.USER) {
      const u = await this.prisma.user.findFirst({
        where: { id: actorId },
        select: { fullName: true },
      });
      return u?.fullName ?? null;
    }
    if (actorType === AuditActorType.PLATFORM_USER) {
      const p = await this.prisma.platformUser.findFirst({
        where: { id: actorId },
        select: { fullName: true },
      });
      return p?.fullName ?? null;
    }
    return null;
  }
}
