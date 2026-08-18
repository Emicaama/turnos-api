import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async status() {
    try {
      await this.prisma.$runCommandRaw({ ping: 1 });
      return { status: 'ok', mongo: true };
    } catch {
      return { status: 'down', mongo: false };
    }
  }
}
