import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { BinnacleService } from './binnacle.service';

@ApiTags('binnacle')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(Role.Admin, Role.Secretaria)
@Controller('binnacle')
export class BinnacleController {
  constructor(private readonly binnacle: BinnacleService) {}

  @Get(':appointmentId')
  list(@Param('appointmentId') appointmentId: string) {
    return this.binnacle.list(appointmentId);
  }
}
