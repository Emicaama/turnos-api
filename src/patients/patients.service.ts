import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueConstraintError } from '../prisma/prisma.errors';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePatientDto) {
    try {
      return await this.prisma.patient.create({ data: toPatientData(dto) });
    } catch (error) {
      throw mapDuplicateDocument(error);
    }
  }

  list() {
    return this.prisma.patient.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async findById(id: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id } });
    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');
    }
    return patient;
  }

  async update(id: string, dto: UpdatePatientDto) {
    await this.findById(id);
    try {
      return await this.prisma.patient.update({
        where: { id },
        data: toPatientData(dto),
      });
    } catch (error) {
      throw mapDuplicateDocument(error);
    }
  }
}

function toPatientData<T extends UpdatePatientDto>(dto: T) {
  const { birthDate, ...rest } = dto;
  return {
    ...rest,
    birthDate: birthDate ? new Date(birthDate) : birthDate,
  } as Omit<T, 'birthDate'> & { birthDate?: Date | null };
}

function mapDuplicateDocument(error: unknown): unknown {
  return isUniqueConstraintError(error)
    ? new ConflictException('Ya existe un paciente con ese documento')
    : error;
}
