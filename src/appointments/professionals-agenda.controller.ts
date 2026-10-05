import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AppointmentsService } from './appointments.service';
import { AgendaQueryDto } from './turno/dto/agenda-query.dto';

@ApiTags('professionals')
@ApiBearerAuth()
@Controller('professionals')
export class ProfessionalsAgendaController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get(':id/agenda')
  agenda(
    @Param('id') id: string,
    @Query() query: AgendaQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.appointmentsService.agenda(id, query.from, query.to, user);
  }
}
