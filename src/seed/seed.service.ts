import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AppointmentStatus } from '../common/enums/appointment-status.enum';
import { Role } from '../common/enums/role.enum';
import { PrismaService } from '../prisma/prisma.service';

export const SEED_ACCOUNTS = {
  secretaria: {
    email: 'secretaria@turnos.local',
    password: 'Secretaria123!',
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
  },
} as const;

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
      this.prisma.binnacleRecord.deleteMany(),
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
    const existing = await this.prisma.user.findUnique({
      where: { email: SEED_ACCOUNTS.secretaria.email },
    });
    if (existing) {
      return this.existingResult();
    }

    const [secretariaHash, medicoHash] = await Promise.all([
      bcrypt.hash(SEED_ACCOUNTS.secretaria.password, 10),
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
        const specialty = await tx.specialty.create({
          data: { name: 'Clínica médica' },
        });
        const maria = await tx.patient.create({
          data: {
            firstName: 'María',
            lastName: 'López',
            documentId: '30111222',
            phone: '1112345678',
          },
        });
        const juan = await tx.patient.create({
          data: {
            firstName: 'Juan',
            lastName: 'Díaz',
            documentId: '28999888',
            phone: '1198765432',
          },
        });

        const ana = await this.createDoctor(tx, {
          firstName: 'Ana',
          lastName: 'Pérez',
          email: SEED_ACCOUNTS.medicos.ana.email,
          passwordHash: medicoHash,
          specialtyId: specialty.id,
          branchId: branch.id,
        });
        const luis = await this.createDoctor(tx, {
          firstName: 'Luis',
          lastName: 'Gómez',
          email: SEED_ACCOUNTS.medicos.luis.email,
          passwordHash: medicoHash,
          specialtyId: specialty.id,
          branchId: branch.id,
        });

        await tx.user.create({
          data: {
            email: SEED_ACCOUNTS.secretaria.email,
            passwordHash: secretariaHash,
            name: 'Secretaría',
            role: Role.Secretaria,
          },
        });

        for (const professionalId of [ana.id, luis.id]) {
          for (const weekday of WEEKDAYS) {
            await tx.availability.create({
              data: {
                professionalId,
                branchId: branch.id,
                weekday,
                startTime: '09:00',
                endTime: '13:00',
                slotMinutes: 30,
              },
            });
          }
        }

        await tx.appointment.createMany({
          data: [
            {
              patientId: maria.id,
              professionalId: ana.id,
              branchId: branch.id,
              startAt: new Date('2026-10-05T09:00:00-03:00'),
              endAt: new Date('2026-10-05T09:30:00-03:00'),
              status: AppointmentStatus.Pendiente,
              notes: 'Control con Ana',
            },
            {
              patientId: juan.id,
              professionalId: ana.id,
              branchId: branch.id,
              startAt: new Date('2026-10-05T10:00:00-03:00'),
              endAt: new Date('2026-10-05T10:30:00-03:00'),
              status: AppointmentStatus.Confirmado,
              notes: 'Control con Ana',
            },
            {
              patientId: maria.id,
              professionalId: luis.id,
              branchId: branch.id,
              startAt: new Date('2026-10-05T11:00:00-03:00'),
              endAt: new Date('2026-10-05T11:30:00-03:00'),
              status: AppointmentStatus.Pendiente,
              notes: 'Control con Luis',
            },
          ],
        });

        return {
          skipped: false,
          branchId: branch.id,
          patientId: maria.id,
          professionalId: ana.id,
        };
      },
      { timeout: 15000 },
    );
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
