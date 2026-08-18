import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { isHmWithinWindow, weekdayAndHm } from './time-in-zone';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateAvailabilityDto) {
    return this.prisma.availability.create({ data: dto });
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
