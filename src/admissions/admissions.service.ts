import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BedsService } from '../beds/beds.service';
import { PatientsService } from '../patients/patients.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { buildProtocol } from './protocols';

@Injectable()
export class AdmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patients: PatientsService,
    private readonly beds: BedsService,
  ) {}

  async admit(dto: CreateAdmissionDto) {
    await this.patients.findById(dto.patientId);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.admission.findFirst({
        where: { patientId: dto.patientId, dischargedAt: null },
      });
      if (current) {
        throw new ConflictException('El paciente ya está internado');
      }
      await this.beds.occupy(tx, dto.bedId);
      return tx.admission.create({
        data: { ...dto, protocolTasks: buildProtocol(dto.reason) },
      });
    });
  }

  listActive() {
    return this.prisma.admission.findMany({
      where: { dischargedAt: null },
      orderBy: { admittedAt: 'asc' },
    });
  }

  async findById(id: string) {
    const admission = await this.prisma.admission.findUnique({
      where: { id },
    });
    if (!admission) {
      throw new NotFoundException('Internación no encontrada');
    }
    return admission;
  }

  async discharge(id: string) {
    const admission = await this.findById(id);
    if (admission.dischargedAt) {
      throw new BadRequestException('La internación ya tiene alta');
    }
    return this.prisma.$transaction(async (tx) => {
      await this.beds.sendToCleaning(tx, admission.bedId);
      return tx.admission.update({
        where: { id },
        data: { dischargedAt: new Date() },
      });
    });
  }
}
