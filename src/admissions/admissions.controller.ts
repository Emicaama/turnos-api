import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdmissionsService } from './admissions.service';
import { CreateAdmissionDto } from './dto/create-admission.dto';

@ApiTags('admissions')
@ApiBearerAuth()
@Controller('admissions')
export class AdmissionsController {
  constructor(private readonly admissions: AdmissionsService) {}

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Secretaria)
  @Post()
  admit(@Body() dto: CreateAdmissionDto) {
    return this.admissions.admit(dto);
  }

  @Get()
  listActive() {
    return this.admissions.listActive();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.admissions.findById(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Secretaria)
  @Post(':id/discharge')
  discharge(@Param('id') id: string) {
    return this.admissions.discharge(id);
  }
}
