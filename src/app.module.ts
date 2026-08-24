import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppointmentsModule } from './appointments/appointments.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { AvailabilityModule } from './availability/availability.module';
import { BranchesModule } from './branches/branches.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { validateEnv } from './config/env.validation';
import { NotificationsModule } from './notifications/notifications.module';
import { PatientsModule } from './patients/patients.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfessionalsModule } from './professionals/professionals.module';
import { SpecialtiesModule } from './specialties/specialties.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    BranchesModule,
    SpecialtiesModule,
    PatientsModule,
    ProfessionalsModule,
    AvailabilityModule,
    AuditModule,
    NotificationsModule,
    AppointmentsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
