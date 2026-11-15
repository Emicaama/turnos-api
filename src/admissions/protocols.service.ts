import { ConflictException, Injectable } from '@nestjs/common';
import { isUniqueConstraintError } from '../prisma/prisma.errors';
import { PrismaService, type PrismaDb } from '../prisma/prisma.service';
import { CreateProtocolDto } from './dto/create-protocol.dto';

@Injectable()
export class ProtocolsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.protocol.findMany({ orderBy: { reason: 'asc' } });
  }

  async create(dto: CreateProtocolDto) {
    try {
      return await this.prisma.protocol.create({ data: dto });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Ya existe un protocolo para ese motivo');
      }
      throw error;
    }
  }

  async tasksFor(db: PrismaDb, reason: string | null): Promise<string[]> {
    if (!reason) {
      return [];
    }
    const protocol = await db.protocol.findUnique({ where: { reason } });
    return protocol?.tasks ?? [];
  }
}
