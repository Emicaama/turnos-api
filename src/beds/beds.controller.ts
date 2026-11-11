import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { BedsService } from './beds.service';
import { ChangeBedStatusDto } from './dto/change-bed-status.dto';
import { CreateBedDto } from './dto/create-bed.dto';

@ApiTags('beds')
@ApiBearerAuth()
@Controller('beds')
export class BedsController {
  constructor(private readonly beds: BedsService) {}

  @Get()
  list() {
    return this.beds.list();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Post()
  create(@Body() dto: CreateBedDto) {
    return this.beds.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Enfermero)
  @Patch(':id/status')
  changeStatus(@Param('id') id: string, @Body() dto: ChangeBedStatusDto) {
    return this.beds.changeStatus(id, dto.status);
  }
}
