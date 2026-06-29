import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { ActorRoleReader } from '../../application/ports/actor-role.reader';
import { AuditActorType } from '../../domain/enums';

/** Resolves a USER actor's role code from the user → role relation (best-effort). */
@Injectable()
export class PrismaActorRoleReader implements ActorRoleReader {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(actorType: AuditActorType, actorId: string | null): Promise<string | null> {
    if (!actorId || actorType !== AuditActorType.USER) {
      return null;
    }
    const u = await this.prisma.user.findFirst({
      where: { id: actorId },
      select: { role: { select: { code: true } } },
    });
    return u?.role?.code ?? null;
  }
}
