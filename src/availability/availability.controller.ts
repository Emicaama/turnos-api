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
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { AvailabilityService } from './availability.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@ApiTags('availability')
@ApiBearerAuth()
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get()
  list(@Query('professionalId') professionalId?: string) {
    return this.availabilityService.list(professionalId);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Secretaria)
  @Post()
  create(@Body() dto: CreateAvailabilityDto) {
    return this.availabilityService.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Secretaria)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAvailabilityDto) {
    return this.availabilityService.update(id, dto);
  }
}
