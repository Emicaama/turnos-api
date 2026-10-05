import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './turno/dto/create-appointment.dto';
import { ListAppointmentsQueryDto } from './turno/dto/list-appointments-query.dto';
import { UpdateAppointmentDto } from './turno/dto/update-appointment.dto';

@ApiTags('appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Secretaria)
  @Post()
  create(@Body() dto: CreateAppointmentDto, @CurrentUser() user: AuthUser) {
    return this.appointmentsService.create(dto, user);
  }

  @Get()
  list(
    @Query() query: ListAppointmentsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.appointmentsService.list(query, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.appointmentsService.findById(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.appointmentsService.update(id, dto, user);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Secretaria)
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.appointmentsService.cancel(id, user);
  }
}
