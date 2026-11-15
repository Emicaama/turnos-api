import { Injectable } from '@nestjs/common';
import {
  AvailabilityModality,
  BedStatus,
  BinnacleKind,
  Coverage,
  Prisma,
  ProfessionalStatus,
  TriageLevel,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { DEFAULT_PROTOCOLS } from '../admissions/protocols';
import { patientShare, splitByCoverage } from '../billing/coverage';
import { AppointmentStatus } from '../common/enums/appointment-status.enum';
import { Role } from '../common/enums/role.enum';
import { isFever } from '../nursing/nursing';
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
/** Lun–sáb para poder agendar también el finde en demos locales. */
const WEEKDAYS = [1, 2, 3, 4, 5, 6];

type SeedPatient = {
  firstName: string;
  lastName: string;
  documentId: string;
  coverage: Coverage;
  copay?: number;
  email?: string;
  address?: string;
  insurer?: string;
  affiliateNumber?: string;
  emergencyContact?: string;
  notes?: string;
};

export type SeedResult = {
  skipped: boolean;
  forced: boolean;
  branchId: string;
  patientId: string;
  professionalId: string;
};

/** Fecha/hora en zona clínica America/Argentina/Buenos_Aires. */
function clinicDate(dayOffset: number, time: string): Date {
  const now = new Date();
  const local = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }),
  );
  local.setHours(0, 0, 0, 0);
  local.setDate(local.getDate() + dayOffset);
  const [hh, mm] = time.split(':').map(Number);
  local.setHours(hh ?? 0, mm ?? 0, 0, 0);
  return local;
}

const BASE_PATIENTS: SeedPatient[] = [
  { firstName: 'Camila', lastName: 'Alonso', documentId: '40111001', coverage: Coverage.particular, email: 'camila.alonso@mail.local', address: 'Calle 1 100', emergencyContact: 'Juan Alonso 11111111' },
  { firstName: 'Mateo', lastName: 'Benitez', documentId: '40111002', coverage: Coverage.publica, address: 'Calle 2 200' },
  { firstName: 'Valentina', lastName: 'Castro', documentId: '40111003', coverage: Coverage.prepaga, copay: 3000, insurer: 'OSDE', affiliateNumber: 'OS-3001' },
  { firstName: 'Santiago', lastName: 'Dominguez', documentId: '40111004', coverage: Coverage.particular },
  { firstName: 'Lucia', lastName: 'Espinosa', documentId: '40111005', coverage: Coverage.publica },
  { firstName: 'Abril', lastName: 'Fernandez', documentId: '40111006', coverage: Coverage.particular },
  { firstName: 'Nina', lastName: 'Gonzalez', documentId: '40111007', coverage: Coverage.prepaga, copay: 2500, insurer: 'Swiss Medical', affiliateNumber: 'SM-770' },
  { firstName: 'Tomas', lastName: 'Herrera', documentId: '40111008', coverage: Coverage.publica },
  { firstName: 'Sofia', lastName: 'Ibanez', documentId: '40111009', coverage: Coverage.particular },
  { firstName: 'Martin', lastName: 'Juarez', documentId: '40111010', coverage: Coverage.publica },
  { firstName: 'Paula', lastName: 'Klein', documentId: '40111011', coverage: Coverage.prepaga, copay: 3000, insurer: 'Galeno', affiliateNumber: 'GA-111' },
  { firstName: 'Diego', lastName: 'Lopez', documentId: '40111012', coverage: Coverage.particular },
  { firstName: 'Rosa', lastName: 'Medina', documentId: '40111013', coverage: Coverage.publica },
  { firstName: 'Ivan', lastName: 'Navarro', documentId: '40111014', coverage: Coverage.particular },
  { firstName: 'Elena', lastName: 'Ortiz', documentId: '40111015', coverage: Coverage.prepaga, copay: 4000, insurer: 'OSDE', affiliateNumber: 'OS-4015' },
  { firstName: 'Hugo', lastName: 'Paredes', documentId: '40111016', coverage: Coverage.particular },
  { firstName: 'Vera', lastName: 'Quiroga', documentId: '40111017', coverage: Coverage.publica },
  { firstName: 'Bruno', lastName: 'Romero', documentId: '40111018', coverage: Coverage.particular },
  { firstName: 'Nora', lastName: 'Silva', documentId: '40111019', coverage: Coverage.prepaga, copay: 3000, insurer: 'Medicus', affiliateNumber: 'ME-919' },
  { firstName: 'Gael', lastName: 'Torres', documentId: '40111020', coverage: Coverage.particular, notes: 'Internación activa de cirugía', emergencyContact: 'Laura Torres 1144444444' },
  { firstName: 'Carlos', lastName: 'Yepez', documentId: '40111021', coverage: Coverage.publica, notes: 'Alta reciente respiratorio' },
  { firstName: 'Marina', lastName: 'Vidal', documentId: '40111022', coverage: Coverage.prepaga, copay: 3500, insurer: 'OSDE', affiliateNumber: 'OS-922' },
  { firstName: 'Leo', lastName: 'Acosta', documentId: '40111023', coverage: Coverage.particular },
  { firstName: 'Julia', lastName: 'Bustos', documentId: '40111024', coverage: Coverage.publica },
];

@Injectable()
export class SeedService {
  constructor(private readonly prisma: PrismaService) {}

  async reset(): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.accountLine.deleteMany(),
      this.prisma.charge.deleteMany(),
      this.prisma.doseAdministration.deleteMany(),
      this.prisma.prescription.deleteMany(),
      this.prisma.vitalSign.deleteMany(),
      this.prisma.admission.deleteMany(),
      this.prisma.protocol.deleteMany(),
      this.prisma.bed.deleteMany(),
      this.prisma.wing.deleteMany(),
      this.prisma.supply.deleteMany(),
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

  async run(force = process.env.SEED_FORCE === '1'): Promise<SeedResult> {
    if (force) {
      await this.reset();
    }

    await this.ensureAdmin();
    await this.ensureProtocols();

    const existing = await this.prisma.user.findUnique({
      where: { email: SEED_ACCOUNTS.secretaria.email },
    });
    if (existing && !force) {
      return { ...(await this.existingResult()), forced: false };
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
        await tx.branch.create({
          data: {
            name: 'Anexo Norte',
            address: 'Av. Cabildo 2500',
          },
        });

        const clinica = await tx.specialty.create({
          data: {
            name: 'Clínica médica',
            description: 'Atención clínica general',
            icon: 'bi-clipboard2-pulse',
          },
        });
        const cardiologia = await tx.specialty.create({
          data: {
            name: 'Cardiología',
            description: 'Control cardiovascular',
            icon: 'bi-heart-pulse',
          },
        });
        const pediatria = await tx.specialty.create({
          data: {
            name: 'Pediatría',
            description: 'Atención de niños y adolescentes',
            icon: 'bi-emoji-smile',
          },
        });
        await tx.specialty.create({
          data: {
            name: 'Traumatología',
            description: 'Lesiones osteoarticulares',
            icon: 'bi-bandaid',
            active: false,
          },
        });

        const patients: { id: string; documentId: string }[] = [];
        for (const input of BASE_PATIENTS) {
          patients.push(
            await tx.patient.create({
              data: {
                firstName: input.firstName,
                lastName: input.lastName,
                documentId: input.documentId,
                phone: `11${input.documentId.slice(-8)}`,
                email: input.email,
                address: input.address,
                insurer: input.insurer,
                affiliateNumber: input.affiliateNumber,
                emergencyContact: input.emergencyContact,
                notes: input.notes,
                coverage: input.coverage,
                copay: input.copay ?? 0,
                birthDate: new Date('1990-05-15'),
              },
            }),
          );
        }
        const byDoc = (doc: string) =>
          patients.find((p) => p.documentId === doc)!;

        const ana = await this.createDoctor(tx, {
          firstName: 'Ana',
          lastName: 'Pérez',
          email: SEED_ACCOUNTS.medicos.ana.email,
          passwordHash: medicoHash,
          specialtyId: clinica.id,
          branchId: branch.id,
          licenseNumber: 'MN-1001',
          phone: '1155551001',
          office: 'Consultorio 1',
        });
        const luis = await this.createDoctor(tx, {
          firstName: 'Luis',
          lastName: 'Gómez',
          email: SEED_ACCOUNTS.medicos.luis.email,
          passwordHash: medicoHash,
          specialtyId: clinica.id,
          branchId: branch.id,
          licenseNumber: 'MN-1002',
          phone: '1155551002',
          office: 'Consultorio 2',
        });
        const carla = await this.createDoctor(tx, {
          firstName: 'Carla',
          lastName: 'Ruiz',
          email: SEED_ACCOUNTS.medicos.carla.email,
          passwordHash: medicoHash,
          specialtyId: cardiologia.id,
          branchId: branch.id,
          licenseNumber: 'MN-2001',
          phone: '1155552001',
          office: 'Consultorio 3',
        });
        const diego = await this.createDoctor(tx, {
          firstName: 'Diego',
          lastName: 'Fernández',
          email: SEED_ACCOUNTS.medicos.diego.email,
          passwordHash: medicoHash,
          specialtyId: pediatria.id,
          branchId: branch.id,
          licenseNumber: 'MN-3001',
          phone: '1155553001',
          office: 'Consultorio 4',
          status: ProfessionalStatus.activo,
        });
        const elena = await this.createDoctor(tx, {
          firstName: 'Elena',
          lastName: 'Soto',
          email: SEED_ACCOUNTS.medicos.elena.email,
          passwordHash: medicoHash,
          specialtyId: clinica.id,
          branchId: branch.id,
          licenseNumber: 'MN-1003',
          phone: '1155551003',
          office: 'Consultorio 5',
          status: ProfessionalStatus.licencia,
        });
        const doctors = [ana, luis, carla, diego, elena];

        await tx.user.create({
          data: {
            email: SEED_ACCOUNTS.secretaria.email,
            passwordHash: secretariaHash,
            name: 'Secretaría General',
            role: Role.Secretaria,
          },
        });
        const enfermero = await tx.user.create({
          data: {
            email: SEED_ACCOUNTS.enfermero.email,
            passwordHash: enfermeroHash,
            name: 'Martín Torres',
            role: Role.Enfermero,
          },
        });

        const ala1 = await tx.wing.create({
          data: { name: 'Ala 1', code: 1, description: 'Internación general' },
        });
        const ala2 = await tx.wing.create({
          data: { name: 'Ala 2', code: 2, description: 'Cirugía' },
        });
        const ala3 = await tx.wing.create({
          data: { name: 'Ala 3', code: 3, description: 'Mantenimiento' },
        });
        await tx.bed.create({
          data: {
            number: '101',
            wingId: ala1.id,
            sala: ala1.name,
            habitacion: '101',
          },
        });
        await tx.bed.create({
          data: {
            number: '102',
            wingId: ala1.id,
            sala: ala1.name,
            habitacion: '102',
          },
        });
        const bedOcupada = await tx.bed.create({
          data: {
            number: '204',
            wingId: ala2.id,
            sala: ala2.name,
            habitacion: '204',
            status: BedStatus.ocupada,
          },
        });
        const bedOcupada2 = await tx.bed.create({
          data: {
            number: '206',
            wingId: ala2.id,
            sala: ala2.name,
            habitacion: '206',
            status: BedStatus.ocupada,
          },
        });
        const bedLimpieza = await tx.bed.create({
          data: {
            number: '205',
            wingId: ala2.id,
            sala: ala2.name,
            habitacion: '205',
            status: BedStatus.en_limpieza,
          },
        });
        await tx.bed.create({
          data: {
            number: '310',
            wingId: ala3.id,
            sala: ala3.name,
            habitacion: '310',
            status: BedStatus.bloqueada,
          },
        });

        const ibuprofeno = await tx.supply.create({
          data: { name: 'Ibuprofeno 400 mg', stock: 50, price: 1200 },
        });
        const suero = await tx.supply.create({
          data: { name: 'Suero fisiológico 500 ml', stock: 38, price: 800 },
        });
        const amoxi = await tx.supply.create({
          data: { name: 'Amoxicilina 500 mg', stock: 80, price: 950 },
        });
        const dipirona = await tx.supply.create({
          data: { name: 'Dipirona 1 g', stock: 60, price: 700 },
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
                room: doctor.office || undefined,
                modality: AvailabilityModality.presencial,
              },
            });
            await tx.availability.create({
              data: {
                professionalId: doctor.id,
                branchId: branch.id,
                weekday,
                startTime: '14:00',
                endTime: '18:00',
                slotMinutes: 30,
                room: doctor.office || undefined,
                modality:
                  doctor.id === carla.id
                    ? AvailabilityModality.mixta
                    : AvailabilityModality.presencial,
              },
            });
          }
        }

        // Turnos: hoy, ayer, mañana y próximos días — todos los estados.
        const agenda: Array<{
          patientDoc: string;
          doctor: { id: string };
          dayOffset: number;
          time: string;
          status: AppointmentStatus;
          charge?: boolean;
          notes?: string;
        }> = [
          { patientDoc: '40111001', doctor: ana, dayOffset: 0, time: '09:00', status: AppointmentStatus.Programado, charge: true, notes: 'Control clínico' },
          { patientDoc: '40111002', doctor: luis, dayOffset: 0, time: '09:30', status: AppointmentStatus.Programado, charge: true, notes: 'Control clínica' },
          { patientDoc: '40111003', doctor: carla, dayOffset: 0, time: '10:00', status: AppointmentStatus.EnSalaDeEspera, charge: true, notes: 'ECG de control' },
          { patientDoc: '40111004', doctor: diego, dayOffset: 0, time: '10:30', status: AppointmentStatus.Programado, notes: 'Consulta pediátrica' },
          { patientDoc: '40111005', doctor: ana, dayOffset: 0, time: '11:00', status: AppointmentStatus.Atendido, notes: 'Atendido esta mañana' },
          { patientDoc: '40111006', doctor: luis, dayOffset: 0, time: '11:30', status: AppointmentStatus.Programado },
          { patientDoc: '40111007', doctor: carla, dayOffset: 0, time: '14:00', status: AppointmentStatus.Programado },
          { patientDoc: '40111008', doctor: diego, dayOffset: 0, time: '14:30', status: AppointmentStatus.Cancelado, notes: 'Cancelado por paciente' },
          { patientDoc: '40111009', doctor: ana, dayOffset: -1, time: '09:00', status: AppointmentStatus.Atendido },
          { patientDoc: '40111010', doctor: luis, dayOffset: -1, time: '10:00', status: AppointmentStatus.Atendido },
          { patientDoc: '40111011', doctor: carla, dayOffset: -1, time: '11:00', status: AppointmentStatus.Cancelado },
          { patientDoc: '40111012', doctor: diego, dayOffset: 1, time: '09:00', status: AppointmentStatus.Programado },
          { patientDoc: '40111013', doctor: ana, dayOffset: 1, time: '09:30', status: AppointmentStatus.Programado },
          { patientDoc: '40111014', doctor: luis, dayOffset: 1, time: '10:00', status: AppointmentStatus.Programado },
          { patientDoc: '40111015', doctor: carla, dayOffset: 2, time: '09:00', status: AppointmentStatus.Programado },
          { patientDoc: '40111016', doctor: diego, dayOffset: 2, time: '10:00', status: AppointmentStatus.Programado },
          { patientDoc: '40111017', doctor: ana, dayOffset: 3, time: '09:00', status: AppointmentStatus.Programado },
          { patientDoc: '40111018', doctor: luis, dayOffset: 3, time: '10:30', status: AppointmentStatus.Programado },
          { patientDoc: '40111019', doctor: carla, dayOffset: 4, time: '11:00', status: AppointmentStatus.Programado },
          { patientDoc: '40111022', doctor: ana, dayOffset: 0, time: '15:00', status: AppointmentStatus.Programado },
        ];

        const appointments: { id: string; patientId: string; status: AppointmentStatus }[] = [];
        for (const item of agenda) {
          const patient = byDoc(item.patientDoc);
          const startAt = clinicDate(item.dayOffset, item.time);
          const appointment = await tx.appointment.create({
            data: {
              patientId: patient.id,
              professionalId: item.doctor.id,
              branchId: branch.id,
              startAt,
              endAt: new Date(startAt.getTime() + 30 * 60 * 1000),
              status: item.status,
              notes: item.notes || 'Agenda demo',
            },
          });
          appointments.push({
            id: appointment.id,
            patientId: patient.id,
            status: item.status,
          });

          await tx.binnacleRecord.create({
            data: {
              appointmentId: appointment.id,
              authorName: 'Secretaría General',
              text: `Turno ${item.status} generado por seed`,
              kind: BinnacleKind.agenda,
            },
          });

          if (item.charge) {
            const patientRow = BASE_PATIENTS.find(
              (p) => p.documentId === item.patientDoc,
            )!;
            const splits = splitByCoverage(
              patientRow.coverage,
              CONSULTATION_PRICE,
              patientRow.copay ?? 0,
            );
            await tx.charge.createMany({
              data: splits.map((split) => ({
                appointmentId: appointment.id,
                ...split,
              })),
            });
            await tx.patient.update({
              where: { id: patient.id },
              data: { appointmentBalance: { increment: patientShare(splits) } },
            });
          }
        }

        // Lista de espera
        await tx.waitlistEntry.create({
          data: {
            patientId: byDoc('40111023').id,
            professionalId: ana.id,
            branchId: branch.id,
            day: clinicDate(0, '00:00').toISOString().slice(0, 10),
          },
        });
        await tx.waitlistEntry.create({
          data: {
            patientId: byDoc('40111024').id,
            professionalId: carla.id,
            branchId: branch.id,
            day: clinicDate(1, '00:00').toISOString().slice(0, 10),
          },
        });

        // Triaje
        await tx.triageEntry.createMany({
          data: [
            {
              patientId: byDoc('40111004').id,
              branchId: branch.id,
              level: TriageLevel.rojo,
              createdAt: clinicDate(0, '08:10'),
            },
            {
              patientId: byDoc('40111003').id,
              branchId: branch.id,
              level: TriageLevel.amarillo,
              createdAt: clinicDate(0, '08:20'),
            },
            {
              patientId: byDoc('40111006').id,
              branchId: branch.id,
              level: TriageLevel.verde,
              createdAt: clinicDate(0, '08:30'),
            },
          ],
        });

        // Internaciones
        const torres = byDoc('40111020');
        const vidal = byDoc('40111022');
        const yepez = byDoc('40111021');

        const stay = await tx.admission.create({
          data: {
            patientId: torres.id,
            bedId: bedOcupada.id,
            reason: 'cirugia',
            protocolTasks: DEFAULT_PROTOCOLS.cirugia,
            diagnosis: 'Apendicitis aguda',
            treatingProfessionalId: ana.id,
            notes: 'Postoperatorio estable',
            admittedAt: clinicDate(-4, '08:00'),
          },
        });
        const stay2 = await tx.admission.create({
          data: {
            patientId: vidal.id,
            bedId: bedOcupada2.id,
            reason: 'respiratorio',
            protocolTasks: DEFAULT_PROTOCOLS.respiratorio,
            diagnosis: 'Neumonía comunitaria',
            treatingProfessionalId: carla.id,
            notes: 'Requiere controles cada 6 h',
            admittedAt: clinicDate(-1, '18:00'),
          },
        });
        await tx.admission.create({
          data: {
            patientId: yepez.id,
            bedId: bedLimpieza.id,
            reason: 'respiratorio',
            protocolTasks: DEFAULT_PROTOCOLS.respiratorio,
            diagnosis: 'Crisis asmática resuelta',
            treatingProfessionalId: luis.id,
            admittedAt: clinicDate(-6, '08:00'),
            dischargedAt: clinicDate(-5, '18:00'),
          },
        });

        await tx.binnacleRecord.createMany({
          data: [
            {
              admissionId: stay.id,
              authorName: 'Ana Pérez',
              text: 'Ingreso a quirófano sin complicaciones',
              kind: BinnacleKind.agenda,
            },
            {
              admissionId: stay2.id,
              authorName: enfermero.name,
              text: 'Paciente con tos productiva, saturación controlada',
              kind: BinnacleKind.signos,
            },
          ],
        });

        // Signos vitales
        const vitals = [
          {
            admissionId: stay.id,
            patientId: torres.id,
            sistolica: 120,
            diastolica: 80,
            frecuenciaCardiaca: 78,
            temperatura: 36.6,
            notes: 'Control matutino',
            at: clinicDate(0, '07:30'),
          },
          {
            admissionId: stay.id,
            patientId: torres.id,
            sistolica: 128,
            diastolica: 84,
            frecuenciaCardiaca: 88,
            temperatura: 37.9,
            notes: 'Ligera febrícula',
            at: clinicDate(0, '13:00'),
          },
          {
            admissionId: stay2.id,
            patientId: vidal.id,
            sistolica: 110,
            diastolica: 70,
            frecuenciaCardiaca: 92,
            temperatura: 38.2,
            notes: 'Fiebre persistente',
            at: clinicDate(0, '08:00'),
          },
        ];
        for (const v of vitals) {
          const fever = isFever(v.temperatura);
          await tx.vitalSign.create({
            data: {
              admissionId: v.admissionId,
              patientId: v.patientId,
              sistolica: v.sistolica,
              diastolica: v.diastolica,
              frecuenciaCardiaca: v.frecuenciaCardiaca,
              temperatura: v.temperatura,
              fueraDeRango: fever,
              notes: v.notes,
              authorUserId: enfermero.id,
              authorName: enfermero.name,
              createdAt: v.at,
            },
          });
          await tx.binnacleRecord.create({
            data: {
              admissionId: v.admissionId,
              authorName: enfermero.name,
              text: fever
                ? 'Control de signos con fiebre'
                : 'El control de signos salió bien',
              kind: BinnacleKind.signos,
              createdAt: v.at,
            },
          });
        }

        // Prescripciones y dosis
        const rxSuero = await tx.prescription.create({
          data: {
            patientId: torres.id,
            supplyId: suero.id,
            dosis: '500 ml',
            cadaHoras: 8,
          },
        });
        const rxIbu = await tx.prescription.create({
          data: {
            patientId: torres.id,
            supplyId: ibuprofeno.id,
            dosis: '1 comprimido',
            cadaHoras: 8,
          },
        });
        const rxAmoxi = await tx.prescription.create({
          data: {
            patientId: vidal.id,
            supplyId: amoxi.id,
            dosis: '1 cápsula',
            cadaHoras: 8,
          },
        });
        await tx.prescription.create({
          data: {
            patientId: vidal.id,
            supplyId: dipirona.id,
            dosis: '1 ampolla',
            cadaHoras: 6,
          },
        });

        const dose1 = await tx.doseAdministration.create({
          data: {
            indicacionId: rxSuero.id,
            admissionId: stay.id,
            horaIndicada: clinicDate(0, '08:00'),
            administradaEn: clinicDate(0, '08:10'),
            authorUserId: enfermero.id,
            authorName: enfermero.name,
          },
        });
        const dose2 = await tx.doseAdministration.create({
          data: {
            indicacionId: rxIbu.id,
            admissionId: stay.id,
            horaIndicada: clinicDate(0, '08:00'),
            administradaEn: clinicDate(0, '08:15'),
            authorUserId: enfermero.id,
            authorName: enfermero.name,
          },
        });
        const dose3 = await tx.doseAdministration.create({
          data: {
            indicacionId: rxAmoxi.id,
            admissionId: stay2.id,
            horaIndicada: clinicDate(0, '09:00'),
            administradaEn: clinicDate(0, '09:05'),
            authorUserId: enfermero.id,
            authorName: enfermero.name,
          },
        });

        await tx.accountLine.createMany({
          data: [
            {
              admissionId: stay.id,
              doseId: dose1.id,
              concept: 'Insumos de Farmacia',
              amount: suero.price,
            },
            {
              admissionId: stay.id,
              doseId: dose2.id,
              concept: 'Insumos de Farmacia',
              amount: ibuprofeno.price,
            },
            {
              admissionId: stay2.id,
              doseId: dose3.id,
              concept: 'Insumos de Farmacia',
              amount: amoxi.price,
            },
          ],
        });

        await tx.patient.update({
          where: { id: torres.id },
          data: { supplyBalance: suero.price + ibuprofeno.price },
        });
        await tx.patient.update({
          where: { id: vidal.id },
          data: { supplyBalance: amoxi.price },
        });

        await tx.binnacleRecord.createMany({
          data: [
            {
              admissionId: stay.id,
              authorName: enfermero.name,
              text: 'Dosis de suero administrada',
              kind: BinnacleKind.medicacion,
            },
            {
              admissionId: stay2.id,
              authorName: enfermero.name,
              text: 'Amoxicilina administrada',
              kind: BinnacleKind.medicacion,
            },
          ],
        });

        await tx.supply.update({
          where: { id: suero.id },
          data: { stock: { decrement: 1 } },
        });
        await tx.supply.update({
          where: { id: ibuprofeno.id },
          data: { stock: { decrement: 1 } },
        });
        await tx.supply.update({
          where: { id: amoxi.id },
          data: { stock: { decrement: 1 } },
        });

        return {
          skipped: false,
          forced: force,
          branchId: branch.id,
          patientId: patients[0].id,
          professionalId: ana.id,
        };
      },
      { timeout: 60000 },
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

  private async ensureProtocols(): Promise<void> {
    await this.prisma.protocol.createMany({
      data: Object.entries(DEFAULT_PROTOCOLS).map(([reason, tasks]) => ({
        reason,
        tasks,
      })),
      skipDuplicates: true,
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
      licenseNumber?: string;
      phone?: string;
      office?: string;
      status?: ProfessionalStatus;
    },
  ) {
    const professional = await tx.professional.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        specialtyIds: [input.specialtyId],
        branchIds: [input.branchId],
        licenseNumber: input.licenseNumber,
        phone: input.phone,
        email: input.email,
        office: input.office,
        status: input.status ?? ProfessionalStatus.activo,
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

  private async existingResult(): Promise<Omit<SeedResult, 'forced'>> {
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
