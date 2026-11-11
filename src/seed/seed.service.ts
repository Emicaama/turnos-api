import { Injectable } from '@nestjs/common';
import {
  AdmissionReason,
  BedStatus,
  Coverage,
  Prisma,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { buildProtocol } from '../admissions/protocols';
import { splitByCoverage } from '../billing/coverage';
import { AppointmentStatus } from '../common/enums/appointment-status.enum';
import { Role } from '../common/enums/role.enum';
import { PrismaService } from '../prisma/prisma.service';

export const SEED_ACCOUNTS = {
  admin: {
    email: 'admin@turnos.local',
    password: 'Admin123!',
  },
  secretaria: {
    email: 'secretaria@turnos.local',
    password: 'Secretaria123!',
  },
  enfermero: {
    email: 'enfermero@turnos.local',
    password: 'Enfermero123!',
  },
  medicos: {
    ana: {
      email: 'ana.perez@turnos.local',
      password: 'Medico123!',
    },
    luis: {
      email: 'luis.gomez@turnos.local',
      password: 'Medico123!',
    },
    carla: {
      email: 'carla.ruiz@turnos.local',
      password: 'Medico123!',
    },
    diego: {
      email: 'diego.fernandez@turnos.local',
      password: 'Medico123!',
    },
    elena: {
      email: 'elena.soto@turnos.local',
      password: 'Medico123!',
    },
  },
} as const;

const CONSULTATION_PRICE = 15000;

type SeedPatient = {
  firstName: string;
  lastName: string;
  documentId: string;
  coverage: Coverage;
  copay?: number;
  status: AppointmentStatus;
  charge: boolean;
};

/** Un paciente distinto por turno. La semana es la del 9 al 13 de noviembre de 2026. */
const AGENDA_PATIENTS: SeedPatient[] = [
  { firstName: 'Camila', lastName: 'Alonso', documentId: '40111001', coverage: Coverage.particular, status: AppointmentStatus.Programado, charge: true },
  { firstName: 'Mateo', lastName: 'Benitez', documentId: '40111002', coverage: Coverage.publica, status: AppointmentStatus.Programado, charge: true },
  { firstName: 'Valentina', lastName: 'Castro', documentId: '40111003', coverage: Coverage.prepaga, copay: 3000, status: AppointmentStatus.Programado, charge: true },
  { firstName: 'Santiago', lastName: 'Dominguez', documentId: '40111004', coverage: Coverage.particular, status: AppointmentStatus.EnSalaDeEspera, charge: false },
  { firstName: 'Lucia', lastName: 'Espinosa', documentId: '40111005', coverage: Coverage.publica, status: AppointmentStatus.Atendido, charge: false },
  { firstName: 'Abril', lastName: 'Fernandez', documentId: '40111006', coverage: Coverage.particular, status: AppointmentStatus.Programado, charge: false },
  { firstName: 'Nina', lastName: 'Gonzalez', documentId: '40111007', coverage: Coverage.prepaga, copay: 2500, status: AppointmentStatus.Programado, charge: false },
  { firstName: 'Tomas', lastName: 'Herrera', documentId: '40111008', coverage: Coverage.publica, status: AppointmentStatus.Programado, charge: false },
  { firstName: 'Sofia', lastName: 'Ibanez', documentId: '40111009', coverage: Coverage.particular, status: AppointmentStatus.EnSalaDeEspera, charge: false },
  { firstName: 'Martin', lastName: 'Juarez', documentId: '40111010', coverage: Coverage.publica, status: AppointmentStatus.Atendido, charge: false },
  { firstName: 'Paula', lastName: 'Klein', documentId: '40111011', coverage: Coverage.prepaga, copay: 3000, status: AppointmentStatus.Programado, charge: false },
  { firstName: 'Diego', lastName: 'Lopez', documentId: '40111012', coverage: Coverage.particular, status: AppointmentStatus.Programado, charge: false },
  { firstName: 'Rosa', lastName: 'Medina', documentId: '40111013', coverage: Coverage.publica, status: AppointmentStatus.Programado, charge: false },
  { firstName: 'Ivan', lastName: 'Navarro', documentId: '40111014', coverage: Coverage.particular, status: AppointmentStatus.Programado, charge: false },
  { firstName: 'Elena', lastName: 'Ortiz', documentId: '40111015', coverage: Coverage.prepaga, copay: 4000, status: AppointmentStatus.Programado, charge: false },
  { firstName: 'Hugo', lastName: 'Paredes', documentId: '40111016', coverage: Coverage.particular, status: AppointmentStatus.Cancelado, charge: false },
  { firstName: 'Vera', lastName: 'Quiroga', documentId: '40111017', coverage: Coverage.publica, status: AppointmentStatus.Programado, charge: false },
  { firstName: 'Bruno', lastName: 'Romero', documentId: '40111018', coverage: Coverage.particular, status: AppointmentStatus.Programado, charge: false },
  { firstName: 'Nora', lastName: 'Silva', documentId: '40111019', coverage: Coverage.prepaga, copay: 3000, status: AppointmentStatus.Programado, charge: false },
  { firstName: 'Gael', lastName: 'Torres', documentId: '40111020', coverage: Coverage.particular, status: AppointmentStatus.Programado, charge: false },
];

const AGENDA_DAYS = [9, 10, 11, 12, 13];
const AGENDA_TIMES = ['09:00', '09:30', '10:00', '10:30'];

export type SeedResult = {
  skipped: boolean;
  branchId: string;
  patientId: string;
  professionalId: string;
};

const WEEKDAYS = [1, 2, 3, 4, 5];

@Injectable()
export class SeedService {
  constructor(private readonly prisma: PrismaService) {}

  async reset(): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.accountLine.deleteMany(),
      this.prisma.charge.deleteMany(),
      this.prisma.admission.deleteMany(),
      this.prisma.bed.deleteMany(),
      this.prisma.doseAdministration.deleteMany(),
      this.prisma.prescription.deleteMany(),
      this.prisma.supply.deleteMany(),
      this.prisma.vitalSign.deleteMany(),
      this.prisma.triageEntry.deleteMany(),
      this.prisma.binnacleRecord.deleteMany(),
      this.prisma.waitlistEntry.deleteMany(),
      this.prisma.appointment.deleteMany(),
      this.prisma.availability.deleteMany(),
      this.prisma.professional.deleteMany(),
      this.prisma.patient.deleteMany(),
      this.prisma.specialty.deleteMany(),
      this.prisma.branch.deleteMany(),
      this.prisma.user.deleteMany(),
    ]);
  }

  async run(): Promise<SeedResult> {
    await this.ensureAdmin();
    const existing = await this.prisma.user.findUnique({
      where: { email: SEED_ACCOUNTS.secretaria.email },
    });
    if (existing) {
      return this.existingResult();
    }

    const [secretariaHash, enfermeroHash, medicoHash] = await Promise.all([
      bcrypt.hash(SEED_ACCOUNTS.secretaria.password, 10),
      bcrypt.hash(SEED_ACCOUNTS.enfermero.password, 10),
      bcrypt.hash(SEED_ACCOUNTS.medicos.ana.password, 10),
    ]);

    return this.prisma.$transaction(
      async (tx) => {
        const branch = await tx.branch.create({
          data: {
            name: 'Sede Central',
            address: 'Av. Corrientes 1234',
          },
        });
        const clinica = await tx.specialty.create({
          data: { name: 'Clínica médica', description: 'Atención clínica general' },
        });
        const cardiologia = await tx.specialty.create({
          data: { name: 'Cardiología', description: 'Control cardiovascular' },
        });
        const pediatria = await tx.specialty.create({
          data: { name: 'Pediatría', description: 'Atención de niños y adolescentes' },
        });

        const patients: { id: string }[] = [];
        for (const input of AGENDA_PATIENTS) {
          patients.push(
            await tx.patient.create({
              data: {
                firstName: input.firstName,
                lastName: input.lastName,
                documentId: input.documentId,
                phone: `11${input.documentId.slice(-8)}`,
                coverage: input.coverage,
                copay: input.copay ?? 0,
              },
            }),
          );
        }
        const yepez = await tx.patient.create({
          data: {
            firstName: 'Carlos',
            lastName: 'Yepez',
            documentId: '40111021',
            phone: '1140111021',
            coverage: Coverage.publica,
          },
        });

        const ana = await this.createDoctor(tx, {
          firstName: 'Ana',
          lastName: 'Pérez',
          email: SEED_ACCOUNTS.medicos.ana.email,
          passwordHash: medicoHash,
          specialtyId: clinica.id,
          branchId: branch.id,
        });
        const luis = await this.createDoctor(tx, {
          firstName: 'Luis',
          lastName: 'Gómez',
          email: SEED_ACCOUNTS.medicos.luis.email,
          passwordHash: medicoHash,
          specialtyId: clinica.id,
          branchId: branch.id,
        });
        const carla = await this.createDoctor(tx, {
          firstName: 'Carla',
          lastName: 'Ruiz',
          email: SEED_ACCOUNTS.medicos.carla.email,
          passwordHash: medicoHash,
          specialtyId: cardiologia.id,
          branchId: branch.id,
        });
        const diego = await this.createDoctor(tx, {
          firstName: 'Diego',
          lastName: 'Fernández',
          email: SEED_ACCOUNTS.medicos.diego.email,
          passwordHash: medicoHash,
          specialtyId: pediatria.id,
          branchId: branch.id,
        });
        const elena = await this.createDoctor(tx, {
          firstName: 'Elena',
          lastName: 'Soto',
          email: SEED_ACCOUNTS.medicos.elena.email,
          passwordHash: medicoHash,
          specialtyId: clinica.id,
          branchId: branch.id,
        });
        const doctors = [ana, luis, carla, diego, elena];

        await tx.user.create({
          data: {
            email: SEED_ACCOUNTS.secretaria.email,
            passwordHash: secretariaHash,
            name: 'Secretaría',
            role: Role.Secretaria,
          },
        });
        await tx.user.create({
          data: {
            email: SEED_ACCOUNTS.enfermero.email,
            passwordHash: enfermeroHash,
            name: 'Martín Torres',
            role: Role.Enfermero,
          },
        });
        await tx.bed.create({ data: { number: '101' } });
        const bedOcupada = await tx.bed.create({
          data: { number: '204', status: BedStatus.ocupada },
        });
        const bedLimpieza = await tx.bed.create({
          data: { number: '205', status: BedStatus.en_limpieza },
        });
        await tx.bed.create({
          data: { number: '310', status: BedStatus.bloqueada },
        });
        await tx.supply.create({
          data: { name: 'Ibuprofeno 400 mg', stock: 50, price: 1200 },
        });
        const suero = await tx.supply.create({
          data: { name: 'Suero fisiológico 500 ml', stock: 39, price: 800 },
        });

        for (const doctor of doctors) {
          for (const weekday of WEEKDAYS) {
            await tx.availability.create({
              data: {
                professionalId: doctor.id,
                branchId: branch.id,
                weekday,
                startTime: '09:00',
                endTime: '13:00',
                slotMinutes: 30,
              },
            });
          }
        }

        const torres = patients[AGENDA_PATIENTS.length - 1];
        let torresAppointmentId = '';
        let slot = 0;
        for (const day of AGENDA_DAYS) {
          for (const time of AGENDA_TIMES) {
            const input = AGENDA_PATIENTS[slot];
            const patient = patients[slot];
            const doctor = doctors[slot % doctors.length];
            const startAt = new Date(
              `2026-11-${String(day).padStart(2, '0')}T${time}:00-03:00`,
            );
            const appointment = await tx.appointment.create({
              data: {
                patientId: patient.id,
                professionalId: doctor.id,
                branchId: branch.id,
                startAt,
                endAt: new Date(startAt.getTime() + 30 * 60 * 1000),
                status: input.status,
                notes: 'Control de agenda',
              },
            });
            if (input.charge) {
              await tx.charge.createMany({
                data: splitByCoverage(
                  input.coverage,
                  CONSULTATION_PRICE,
                  input.copay ?? 0,
                ).map((split) => ({ appointmentId: appointment.id, ...split })),
              });
            }
            if (patient.id === torres.id) {
              torresAppointmentId = appointment.id;
            }
            slot += 1;
          }
        }

        const stay = await tx.admission.create({
          data: {
            patientId: torres.id,
            bedId: bedOcupada.id,
            reason: AdmissionReason.cirugia,
            protocolTasks: buildProtocol(AdmissionReason.cirugia),
            admittedAt: new Date('2026-11-10T08:00:00-03:00'),
          },
        });
        await tx.admission.create({
          data: {
            patientId: yepez.id,
            bedId: bedLimpieza.id,
            reason: AdmissionReason.respiratorio,
            protocolTasks: buildProtocol(AdmissionReason.respiratorio),
            admittedAt: new Date('2026-11-08T08:00:00-03:00'),
            dischargedAt: new Date('2026-11-09T18:00:00-03:00'),
          },
        });

        const prescription = await tx.prescription.create({
          data: {
            patientId: torres.id,
            supplyId: suero.id,
            dosis: '500 ml',
            cadaHoras: 8,
          },
        });
        const dose = await tx.doseAdministration.create({
          data: {
            indicacionId: prescription.id,
            appointmentId: torresAppointmentId,
            horaIndicada: new Date('2026-11-13T10:30:00-03:00'),
            administradaEn: new Date('2026-11-13T10:40:00-03:00'),
            authorName: 'Martín Torres',
          },
        });
        await tx.accountLine.create({
          data: {
            admissionId: stay.id,
            doseId: dose.id,
            concept: 'Insumos de Farmacia',
            amount: suero.price,
          },
        });

        return {
          skipped: false,
          branchId: branch.id,
          patientId: patients[0].id,
          professionalId: ana.id,
        };
      },
      { timeout: 30000 },
    );
  }

  private async ensureAdmin(): Promise<void> {
    const { email, password } = SEED_ACCOUNTS.admin;
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return;
    }
    await this.prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 10),
        name: 'Administración',
        role: Role.Admin,
      },
    });
  }

  private async createDoctor(
    tx: Prisma.TransactionClient,
    input: {
      firstName: string;
      lastName: string;
      email: string;
      passwordHash: string;
      specialtyId: string;
      branchId: string;
    },
  ) {
    const professional = await tx.professional.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        specialtyIds: [input.specialtyId],
        branchIds: [input.branchId],
      },
    });
    const user = await tx.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        name: `${input.firstName} ${input.lastName}`,
        role: Role.Profesional,
        professionalId: professional.id,
      },
    });
    return tx.professional.update({
      where: { id: professional.id },
      data: { userId: user.id },
    });
  }

  private async existingResult(): Promise<SeedResult> {
    const [branch, patient, ana] = await Promise.all([
      this.prisma.branch.findFirst({ orderBy: { createdAt: 'asc' } }),
      this.prisma.patient.findFirst({ orderBy: { createdAt: 'asc' } }),
      this.prisma.user.findUnique({
        where: { email: SEED_ACCOUNTS.medicos.ana.email },
      }),
    ]);
    if (!branch || !patient || !ana?.professionalId) {
      throw new Error('El seed quedó incompleto');
    }
    return {
      skipped: true,
      branchId: branch.id,
      patientId: patient.id,
      professionalId: ana.professionalId,
    };
  }
}
