import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BinnacleService {
  constructor(private readonly prisma: PrismaService) {}

  add(appointmentId: string, authorName: string, text: string) {
    return this.prisma.binnacleRecord.create({
      data: { appointmentId, authorName, text },
    });
  }

  list(appointmentId: string) {
    return this.prisma.binnacleRecord.findMany({
      where: { appointmentId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
