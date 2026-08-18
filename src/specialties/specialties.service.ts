import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSpecialtyDto } from './dto/create-specialty.dto';

@Injectable()
export class SpecialtiesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateSpecialtyDto) {
    return this.prisma.specialty.create({ data: dto });
  }

  list() {
    return this.prisma.specialty.findMany({ orderBy: { name: 'asc' } });
  }

  async findById(id: string) {
    const specialty = await this.prisma.specialty.findUnique({ where: { id } });
    if (!specialty) {
      throw new NotFoundException('Especialidad no encontrada');
    }
    return specialty;
  }
}
