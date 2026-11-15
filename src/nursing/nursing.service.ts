import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdmissionsService } from '../admissions/admissions.service';
import type { AuthUser } from '../auth/auth-user';
import { addStayNote } from '../binnacle/binnacle-note';
import { BillingService } from '../billing/billing.service';
import { NOTIFICATION_PORT } from '../notifications/notification.port';
import type { NotificationPort } from '../notifications/notification.port';
import { PatientsService } from '../patients/patients.service';
import { PrismaService } from '../prisma/prisma.service';
import { SuppliesService } from '../supplies/supplies.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { CreateVitalsDto } from './dto/create-vitals.dto';
import { GiveDoseDto } from './dto/give-dose.dto';
import { doseNote, isFever, isWithinDoseWindow, vitalNote } from './nursing';

@Injectable()
export class NursingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admissions: AdmissionsService,
    private readonly patients: PatientsService,
    private readonly supplies: SuppliesService,
    private readonly billing: BillingService,
    @Inject(NOTIFICATION_PORT)
    private readonly notifications: NotificationPort,
  ) {}

  async recordVitals(
    admissionId: string,
    dto: CreateVitalsDto,
    actor: AuthUser,
  ) {
    const admission = await this.admissions.findActive(admissionId);
    const fever = isFever(dto.temperatura);
    const vital = await this.prisma.$transaction(async (tx) => {
      const created = await tx.vitalSign.create({
        data: {
          ...dto,
          admissionId,
          patientId: admission.patientId,
          fueraDeRango: fever,
          authorUserId: actor.id,
          authorName: actor.name,
        },
      });
      await addStayNote(
        tx,
        admissionId,
        actor.name,
        vitalNote(fever),
        'signos',
      );
      return created;
    });
    if (fever) {
      const bed = await this.prisma.bed.findUniqueOrThrow({
        where: { id: admission.bedId },
      });
      await this.notifications.notify({
        type: 'guardia',
        patientId: admission.patientId,
        message: `Cama ${bed.number}: temperatura ${dto.temperatura} °C. Avisar al médico de guardia.`,
      });
    }
    return vital;
  }

  async listVitalsForStay(admissionId: string) {
    await this.admissions.findById(admissionId);
    return this.prisma.vitalSign.findMany({
      where: { admissionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listVitalsForPatient(patientId: string) {
    await this.patients.findById(patientId);
    return this.prisma.vitalSign.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async prescribe(patientId: string, dto: CreatePrescriptionDto) {
    await Promise.all([
      this.patients.findById(patientId),
      this.supplies.findById(dto.supplyId),
    ]);
    return this.prisma.prescription.create({ data: { ...dto, patientId } });
  }

  async listPrescriptions(patientId: string) {
    await this.patients.findById(patientId);
    return this.prisma.prescription.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async giveDose(admissionId: string, dto: GiveDoseDto, actor: AuthUser) {
    const admission = await this.admissions.findActive(admissionId);
    const prescription = await this.prisma.prescription.findUnique({
      where: { id: dto.indicacionId },
    });
    if (!prescription || prescription.patientId !== admission.patientId) {
      throw new NotFoundException('Indicación no encontrada');
    }
    const horaIndicada = new Date(dto.horaIndicada);
    const administradaEn = new Date(dto.administradaEn);
    if (!isWithinDoseWindow(horaIndicada, administradaEn)) {
      throw new BadRequestException(
        'La dosis está fuera de los 30 minutos de la hora indicada',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const supply = await this.supplies.takeOneUnit(tx, prescription.supplyId);
      const dose = await tx.doseAdministration.create({
        data: {
          indicacionId: prescription.id,
          admissionId,
          horaIndicada,
          administradaEn,
          authorUserId: actor.id,
          authorName: actor.name,
        },
      });
      await addStayNote(
        tx,
        admissionId,
        actor.name,
        doseNote(supply.name, prescription.dosis),
        'medicacion',
      );
      const accountLine = await this.billing.chargeSupplyToStay(
        tx,
        admission,
        supply,
        dose.id,
      );
      return { ...dose, stockRestante: supply.stock, accountLine };
    });
  }
}
