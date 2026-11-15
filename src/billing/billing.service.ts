import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Admission, Charge, Prisma, Supply } from '@prisma/client';
import { PatientsService } from '../patients/patients.service';
import { PrismaService } from '../prisma/prisma.service';
import { patientShare, splitByCoverage } from './coverage';

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
    return this.prisma.$transaction(async (tx) => {
      const charges: Charge[] = [];
      for (const split of splits) {
        charges.push(
          await tx.charge.create({ data: { appointmentId, ...split } }),
        );
      }
      await tx.patient.update({
        where: { id: patient.id },
        data: { appointmentBalance: { increment: patientShare(splits) } },
      });
      return charges;
    });
  }

  async chargeSupplyToStay(
    tx: Prisma.TransactionClient,
    stay: Pick<Admission, 'id' | 'patientId'>,
    supply: Supply,
    doseId: string,
  ) {
    const line = await tx.accountLine.create({
      data: {
        admissionId: stay.id,
        doseId,
        concept: 'Insumos de Farmacia',
        amount: supply.price,
      },
    });
    await tx.patient.update({
      where: { id: stay.patientId },
      data: { supplyBalance: { increment: line.amount } },
    });
    return line;
  }

  async clearBalances(patientId: string) {
    await this.patients.findById(patientId);
    return this.prisma.patient.update({
      where: { id: patientId },
      data: { appointmentBalance: 0, supplyBalance: 0 },
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
