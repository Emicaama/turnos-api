import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BedStatus, Prisma } from '@prisma/client';
import { isUniqueConstraintError } from '../prisma/prisma.errors';
import { PrismaService, type PrismaDb } from '../prisma/prisma.service';
import { bedStatusError, canChangeBedStatus } from './bed-status';
import { CreateBedDto } from './dto/create-bed.dto';

@Injectable()
export class BedsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBedDto) {
    try {
      return await this.prisma.bed.create({ data: dto });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Ya existe una cama con ese número');
      }
      throw error;
    }
  }

  list() {
    return this.prisma.bed.findMany({ orderBy: { number: 'asc' } });
  }

  async changeStatus(id: string, next: BedStatus) {
    const bed = await this.findById(id);
    if (!canChangeBedStatus(bed.status, next)) {
      throw new BadRequestException(bedStatusError(bed.status, next));
    }
    if (!(await this.moveIfStillIn(this.prisma, id, bed.status, next))) {
      throw new ConflictException('La cama acaba de cambiar de estado');
    }
    return { ...bed, status: next };
  }

  async occupy(tx: Prisma.TransactionClient, bedId: string) {
    const bed = await this.findById(bedId, tx);
    if (bed.status !== 'libre') {
      throw new ConflictException('La cama no está libre');
    }
    if (!(await this.moveIfStillIn(tx, bedId, 'libre', 'ocupada'))) {
      throw new ConflictException('La cama acaba de ocuparse');
    }
  }

  async sendToCleaning(tx: Prisma.TransactionClient, bedId: string) {
    await tx.bed.update({
      where: { id: bedId },
      data: { status: 'en_limpieza' },
    });
  }

  private async findById(id: string, db: PrismaDb = this.prisma) {
    const bed = await db.bed.findUnique({ where: { id } });
    if (!bed) {
      throw new NotFoundException('Cama no encontrada');
    }
    return bed;
  }

  private async moveIfStillIn(
    db: PrismaDb,
    id: string,
    from: BedStatus,
    to: BedStatus,
  ): Promise<boolean> {
    const { count } = await db.bed.updateMany({
      where: { id, status: from },
      data: { status: to },
    });
    return count === 1;
  }
}
