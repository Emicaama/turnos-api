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
import { ProtocolsService } from './protocols.service';

@Injectable()
export class AdmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patients: PatientsService,
    private readonly beds: BedsService,
    private readonly protocols: ProtocolsService,
  ) {}

  async admit(dto: CreateAdmissionDto) {
    await this.patients.findById(dto.patientId);
    const reason = dto.reason || null;
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.admission.findFirst({
        where: { patientId: dto.patientId, dischargedAt: null },
      });
      if (current) {
        throw new ConflictException('El paciente ya está internado');
      }
      await this.beds.occupy(tx, dto.bedId);
      if (dto.treatingProfessionalId) {
        const professional = await tx.professional.findUnique({
          where: { id: dto.treatingProfessionalId },
        });
        if (!professional) {
          throw new NotFoundException('Profesional no encontrado');
        }
      }
      return tx.admission.create({
        data: {
          patientId: dto.patientId,
          bedId: dto.bedId,
          reason,
          diagnosis: dto.diagnosis,
          treatingProfessionalId: dto.treatingProfessionalId,
          notes: dto.notes,
          protocolTasks: await this.protocols.tasksFor(tx, reason),
        },
      });
    });
  }

  listActive() {
    return this.prisma.admission.findMany({
      where: { dischargedAt: null },
      orderBy: { admittedAt: 'asc' },
    });
  }

  findActiveByPatient(patientId: string) {
    return this.prisma.admission.findFirst({
      where: { patientId, dischargedAt: null },
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

  async findActive(id: string) {
    const admission = await this.findById(id);
    if (admission.dischargedAt) {
      throw new BadRequestException('La internación ya tiene alta');
    }
    return admission;
  }

  async discharge(id: string) {
    const admission = await this.findActive(id);
    return this.prisma.$transaction(async (tx) => {
      await this.beds.sendToCleaning(tx, admission.bedId);
      return tx.admission.update({
        where: { id },
        data: { dischargedAt: new Date() },
      });
    });
  }
}
