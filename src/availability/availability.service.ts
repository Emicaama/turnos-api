import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AvailabilityStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueConstraintError } from '../prisma/prisma.errors';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { isHmWithinWindow, weekdayAndHm } from './time-in-zone';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAvailabilityDto) {
    assertWindowOrder(dto.startTime, dto.endTime);
    try {
      return await this.prisma.availability.create({ data: dto });
    } catch (error) {
      throw mapDuplicateWindow(error);
    }
  }

  async update(id: string, dto: UpdateAvailabilityDto) {
    const current = await this.findById(id);
    assertWindowOrder(
      dto.startTime ?? current.startTime,
      dto.endTime ?? current.endTime,
    );
    try {
      return await this.prisma.availability.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      throw mapDuplicateWindow(error);
    }
  }

  list(professionalId?: string) {
    return this.prisma.availability.findMany({
      where: professionalId ? { professionalId } : undefined,
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    });
  }

  async coversSlot(params: {
    professionalId: string;
    branchId: string;
    startAt: Date;
    endAt: Date;
    timeZone: string;
  }): Promise<boolean> {
    const start = weekdayAndHm(params.startAt, params.timeZone);
    const end = weekdayAndHm(params.endAt, params.timeZone);
    if (start.weekday !== end.weekday) {
      return false;
    }
    const windows = await this.prisma.availability.findMany({
      where: {
        professionalId: params.professionalId,
        branchId: params.branchId,
        weekday: start.weekday,
        status: AvailabilityStatus.activo,
      },
    });
    return windows.some((window) =>
      isHmWithinWindow(start.hm, end.hm, window.startTime, window.endTime),
    );
  }

  async findById(id: string) {
    const item = await this.prisma.availability.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('Disponibilidad no encontrada');
    }
    return item;
  }
}

function assertWindowOrder(startTime: string, endTime: string) {
  if (startTime >= endTime) {
    throw new BadRequestException(
      'La hora de inicio debe ser anterior a la de finalización',
    );
  }
}

function mapDuplicateWindow(error: unknown): unknown {
  return isUniqueConstraintError(error)
    ? new ConflictException(
        'Ese profesional ya tiene una franja que empieza a esa hora ese día en la sucursal',
      )
    : error;
}
