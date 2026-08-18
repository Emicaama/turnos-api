import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { BranchesModule } from '../branches/branches.module';
import { PatientsModule } from '../patients/patients.module';
import { ProfessionalsModule } from '../professionals/professionals.module';
import { SpecialtiesModule } from '../specialties/specialties.module';
import { UsersModule } from '../users/users.module';
import { SeedService } from './seed.service';

@Module({
  imports: [
    UsersModule,
    BranchesModule,
    SpecialtiesModule,
    PatientsModule,
    ProfessionalsModule,
    AvailabilityModule,
  ],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
