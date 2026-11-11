import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { CreateVitalsDto } from './dto/create-vitals.dto';
import { GiveDoseDto } from './dto/give-dose.dto';
import { NursingService } from './nursing.service';

@ApiTags('nursing')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller()
export class NursingController {
  constructor(private readonly nursing: NursingService) {}

  @Roles(Role.Admin, Role.Enfermero)
  @Post('appointments/:id/vitals')
  recordVitals(
    @Param('id') id: string,
    @Body() dto: CreateVitalsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.nursing.recordVitals(id, dto, user);
  }

  @Roles(Role.Admin, Role.Profesional, Role.Enfermero)
  @Get('patients/:id/prescriptions')
  listPrescriptions(@Param('id') id: string) {
    return this.nursing.listPrescriptions(id);
  }

  @Roles(Role.Admin, Role.Profesional)
  @Post('patients/:id/prescriptions')
  prescribe(@Param('id') id: string, @Body() dto: CreatePrescriptionDto) {
    return this.nursing.prescribe(id, dto);
  }

  @Roles(Role.Admin, Role.Enfermero)
  @Post('appointments/:id/doses')
  giveDose(
    @Param('id') id: string,
    @Body() dto: GiveDoseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.nursing.giveDose(id, dto, user);
  }
}
