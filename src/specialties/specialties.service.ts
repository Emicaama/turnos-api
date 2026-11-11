import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueConstraintError } from '../prisma/prisma.errors';
import { CreateSpecialtyDto } from './dto/create-specialty.dto';
import { UpdateSpecialtyDto } from './dto/update-specialty.dto';

@Injectable()
export class SpecialtiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSpecialtyDto) {
    try {
      return await this.prisma.specialty.create({ data: dto });
    } catch (error) {
      throw mapDuplicateName(error);
    }
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

  async update(id: string, dto: UpdateSpecialtyDto) {
    await this.findById(id);
    try {
      return await this.prisma.specialty.update({ where: { id }, data: dto });
    } catch (error) {
      throw mapDuplicateName(error);
    }
  }

  async remove(id: string) {
    await this.findById(id);
    const inUse = await this.prisma.professional.count({
      where: { specialtyIds: { has: id } },
    });
    if (inUse > 0) {
      throw new ConflictException(
        'La especialidad tiene médicos asignados; desactivala en lugar de eliminarla',
      );
    }
    return this.prisma.specialty.delete({ where: { id } });
  }
}

function mapDuplicateName(error: unknown): unknown {
  return isUniqueConstraintError(error)
    ? new ConflictException('Ya existe una especialidad con ese nombre')
    : error;
}
