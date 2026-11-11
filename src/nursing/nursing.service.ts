import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { addBinnacleNote } from '../binnacle/binnacle-note';
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
    private readonly patients: PatientsService,
    private readonly supplies: SuppliesService,
    private readonly billing: BillingService,
    @Inject(NOTIFICATION_PORT)
    private readonly notifications: NotificationPort,
  ) {}

  async recordVitals(
    appointmentId: string,
    dto: CreateVitalsDto,
    actor: AuthUser,
  ) {
    const appointment = await this.findAppointment(appointmentId);
    const fever = isFever(dto.temperatura);
    const vital = await this.prisma.$transaction(async (tx) => {
      const created = await tx.vitalSign.create({
        data: {
          ...dto,
          appointmentId,
          patientId: appointment.patientId,
          fueraDeRango: fever,
          authorName: actor.name,
        },
      });
      await addBinnacleNote(
        tx,
        appointmentId,
        actor.name,
        vitalNote(fever),
        'signos',
      );
      return created;
    });
    if (fever) {
      await this.notifications.notify({
        type: 'guardia',
        patientId: appointment.patientId,
        branchId: appointment.branchId,
        message: `Temperatura ${dto.temperatura} °C. Avisar al médico de guardia.`,
      });
    }
    return vital;
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

  async giveDose(appointmentId: string, dto: GiveDoseDto, actor: AuthUser) {
    const appointment = await this.findAppointment(appointmentId);
    const prescription = await this.prisma.prescription.findUnique({
      where: { id: dto.indicacionId },
    });
    if (!prescription || prescription.patientId !== appointment.patientId) {
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
          appointmentId,
          horaIndicada,
          administradaEn,
          authorName: actor.name,
        },
      });
      await addBinnacleNote(
        tx,
        appointmentId,
        actor.name,
        doseNote(supply.name, prescription.dosis),
        'medicacion',
      );
      const accountLine = await this.billing.chargeSupplyToActiveStay(
        tx,
        appointment.patientId,
        supply,
        dose.id,
      );
      return { ...dose, stockRestante: supply.stock, accountLine };
    });
  }

  private async findAppointment(id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });
    if (!appointment) {
      throw new NotFoundException('Turno no encontrado');
    }
    return appointment;
  }
}
