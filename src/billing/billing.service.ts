import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Supply } from '@prisma/client';
import { PatientsService } from '../patients/patients.service';
import { PrismaService } from '../prisma/prisma.service';
import { splitByCoverage } from './coverage';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patients: PatientsService,
  ) {}

  async chargeConsultation(appointmentId: string, price: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment) {
      throw new NotFoundException('Turno no encontrado');
    }
    if (await this.prisma.charge.count({ where: { appointmentId } })) {
      throw new ConflictException('La consulta ya fue facturada');
    }
    const patient = await this.patients.findById(appointment.patientId);
    const splits = splitByCoverage(patient.coverage, price, patient.copay);
    return this.prisma.$transaction(
      splits.map((split) =>
        this.prisma.charge.create({ data: { appointmentId, ...split } }),
      ),
    );
  }

  async chargeSupplyToActiveStay(
    tx: Prisma.TransactionClient,
    patientId: string,
    supply: Supply,
    doseId: string,
  ) {
    const stay = await tx.admission.findFirst({
      where: { patientId, dischargedAt: null },
    });
    if (!stay) {
      return null;
    }
    return tx.accountLine.create({
      data: {
        admissionId: stay.id,
        doseId,
        concept: 'Insumos de Farmacia',
        amount: supply.price,
      },
    });
  }

  async stayAccount(admissionId: string) {
    const lines = await this.prisma.accountLine.findMany({
      where: { admissionId },
      orderBy: { createdAt: 'asc' },
    });
    const total = lines.reduce((sum, line) => sum + line.amount, 0);
    return { admissionId, lines, total };
  }
}
