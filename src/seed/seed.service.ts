import { Injectable } from '@nestjs/common';
import { AvailabilityService } from '../availability/availability.service';
import { BranchesService } from '../branches/branches.service';
import { Role } from '../common/enums/role.enum';
import { PatientsService } from '../patients/patients.service';
import { ProfessionalsService } from '../professionals/professionals.service';
import { SpecialtiesService } from '../specialties/specialties.service';
import { UsersService } from '../users/users.service';

export const SEED_ACCOUNTS = {
  admin: { email: 'admin@turnos.local', password: 'Admin123!' },
  secretaria: { email: 'secretaria@turnos.local', password: 'Secretaria123!' },
  profesional: {
    email: 'profesional@turnos.local',
    password: 'Profesional123!',
  },
};

@Injectable()
export class SeedService {
  constructor(
    private readonly usersService: UsersService,
    private readonly branchesService: BranchesService,
    private readonly specialtiesService: SpecialtiesService,
    private readonly patientsService: PatientsService,
    private readonly professionalsService: ProfessionalsService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  async run() {
    const existing = await this.usersService.findByEmail(
      SEED_ACCOUNTS.admin.email,
    );
    if (existing) {
      return { skipped: true as const };
    }

    const admin = await this.usersService.create({
      email: SEED_ACCOUNTS.admin.email,
      password: SEED_ACCOUNTS.admin.password,
      name: 'Admin Turnos',
      role: Role.Admin,
    });
    const secretaria = await this.usersService.create({
      email: SEED_ACCOUNTS.secretaria.email,
      password: SEED_ACCOUNTS.secretaria.password,
      name: 'Secretaría Central',
      role: Role.Secretaria,
    });
    const profesionalUser = await this.usersService.create({
      email: SEED_ACCOUNTS.profesional.email,
      password: SEED_ACCOUNTS.profesional.password,
      name: 'Dr. Demo',
      role: Role.Profesional,
    });

    const branch = await this.branchesService.create({
      name: 'Sede Centro',
      address: 'Av. Principal 100',
    });
    const specialty = await this.specialtiesService.create({
      name: 'Clínica médica',
    });
    const professional = await this.professionalsService.create({
      firstName: 'Demo',
      lastName: 'Médico',
      userId: profesionalUser.id,
      specialtyIds: [specialty.id],
      branchIds: [branch.id],
    });
    const patient = await this.patientsService.create({
      firstName: 'Ana',
      lastName: 'Paciente',
      documentId: '30111222',
      email: 'ana@turnos.local',
      phone: '1112345678',
    });

    for (const weekday of [1, 2, 3, 4, 5]) {
      await this.availabilityService.create({
        professionalId: professional.id,
        branchId: branch.id,
        weekday,
        startTime: '09:00',
        endTime: '17:00',
        slotMinutes: 30,
      });
    }

    return {
      skipped: false as const,
      adminId: admin.id,
      secretariaId: secretaria.id,
      profesionalUserId: profesionalUser.id,
      professionalId: professional.id,
      patientId: patient.id,
      branchId: branch.id,
      specialtyId: specialty.id,
    };
  }
}
