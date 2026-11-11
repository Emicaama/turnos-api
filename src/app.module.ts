import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AdmissionsModule } from './admissions/admissions.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AuthModule } from './auth/auth.module';
import { AvailabilityModule } from './availability/availability.module';
import { BedsModule } from './beds/beds.module';
import { BillingModule } from './billing/billing.module';
import { BinnacleModule } from './binnacle/binnacle.module';
import { BranchesModule } from './branches/branches.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { NursingModule } from './nursing/nursing.module';
import { PatientsModule } from './patients/patients.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfessionalsModule } from './professionals/professionals.module';
import { SeedModule } from './seed/seed.module';
import { SpecialtiesModule } from './specialties/specialties.module';
import { SuppliesModule } from './supplies/supplies.module';
import { TriageModule } from './triage/triage.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    HealthModule,
    SeedModule,
    UsersModule,
    AuthModule,
    BranchesModule,
    SpecialtiesModule,
    PatientsModule,
    ProfessionalsModule,
    AvailabilityModule,
    BinnacleModule,
    NotificationsModule,
    NursingModule,
    AppointmentsModule,
    TriageModule,
    SuppliesModule,
    BedsModule,
    AdmissionsModule,
    BillingModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
