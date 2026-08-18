import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(params: {
    actorId: string;
    action: string;
    entity: string;
    entityId: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  }) {
    return this.prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        before: params.before as Prisma.InputJsonValue | undefined,
        after: params.after as Prisma.InputJsonValue | undefined,
      },
    });
  }

  listByEntity(entity: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entity, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
