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
      return await this.prisma.patient.create({ data: dto });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Ya existe un paciente con ese documento');
      }
      throw error;
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
    return this.prisma.patient.update({ where: { id }, data: dto });
  }
}
