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
import { CreateWingDto } from './dto/create-wing.dto';
import { UpdateBedDto } from './dto/update-bed.dto';

@Injectable()
export class BedsService {
  constructor(private readonly prisma: PrismaService) {}

  listWings() {
    return this.prisma.wing.findMany({ orderBy: { code: 'asc' } });
  }

  async createWing(dto: CreateWingDto) {
    try {
      return await this.prisma.wing.create({ data: dto });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Ya existe un ala con ese nombre o código');
      }
      throw error;
    }
  }

  list() {
    return this.prisma.bed.findMany({ orderBy: { number: 'asc' } });
  }

  async create(dto: CreateBedDto) {
    return this.prisma.$transaction(async (tx) => {
      const wing = await this.findWing(dto.wingId, tx);
      const number = await this.nextNumber(tx, wing.code);
      try {
        return await tx.bed.create({
          data: {
            number,
            wingId: wing.id,
            sala: dto.sala ?? wing.name,
            habitacion: dto.habitacion,
          },
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new ConflictException('Ya existe una cama con ese número');
        }
        throw error;
      }
    });
  }

  async update(id: string, dto: UpdateBedDto) {
    const bed = await this.findById(id);
    if (dto.wingId && dto.wingId !== bed.wingId) {
      await this.findWing(dto.wingId);
    }
    return this.prisma.bed.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    const bed = await this.findById(id);
    if (bed.status === 'ocupada') {
      throw new BadRequestException('No se puede eliminar una cama ocupada');
    }
    const active = await this.prisma.admission.count({
      where: { bedId: id, dischargedAt: null },
    });
    if (active) {
      throw new BadRequestException('La cama tiene una internación activa');
    }
    await this.prisma.bed.delete({ where: { id } });
    return { deleted: true };
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
    if (bed.status !== 'disponible') {
      throw new ConflictException('La cama no está libre');
    }
    if (!(await this.moveIfStillIn(tx, bedId, 'disponible', 'ocupada'))) {
      throw new ConflictException('La cama acaba de ocuparse');
    }
  }

  async sendToCleaning(tx: Prisma.TransactionClient, bedId: string) {
    await tx.bed.update({
      where: { id: bedId },
      data: { status: 'en_limpieza' },
    });
  }

  private async findWing(id: string, db: PrismaDb = this.prisma) {
    const wing = await db.wing.findUnique({ where: { id } });
    if (!wing) {
      throw new NotFoundException('Ala no encontrada');
    }
    return wing;
  }

  private async findById(id: string, db: PrismaDb = this.prisma) {
    const bed = await db.bed.findUnique({ where: { id } });
    if (!bed) {
      throw new NotFoundException('Cama no encontrada');
    }
    return bed;
  }

  private async nextNumber(tx: Prisma.TransactionClient, code: number) {
    const prefix = String(code);
    const beds = await tx.bed.findMany({
      where: { number: { startsWith: prefix } },
      select: { number: true },
    });
    let max = 0;
    for (const bed of beds) {
      if (!/^\d+$/.test(bed.number) || !bed.number.startsWith(prefix)) {
        continue;
      }
      const n = Number(bed.number);
      if (n > max) {
        max = n;
      }
    }
    const next = max === 0 ? code * 100 + 1 : max + 1;
    return String(next);
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
