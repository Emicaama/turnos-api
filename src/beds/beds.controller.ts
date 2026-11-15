import {
  Body,
  Controller,
  Delete,
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
import { CreateWingDto } from './dto/create-wing.dto';
import { UpdateBedDto } from './dto/update-bed.dto';

@ApiTags('beds')
@ApiBearerAuth()
@Controller()
export class BedsController {
  constructor(private readonly beds: BedsService) {}

  @Get('wings')
  listWings() {
    return this.beds.listWings();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Post('wings')
  createWing(@Body() dto: CreateWingDto) {
    return this.beds.createWing(dto);
  }

  @Get('beds')
  list() {
    return this.beds.list();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Post('beds')
  create(@Body() dto: CreateBedDto) {
    return this.beds.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Patch('beds/:id')
  update(@Param('id') id: string, @Body() dto: UpdateBedDto) {
    return this.beds.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Delete('beds/:id')
  remove(@Param('id') id: string) {
    return this.beds.remove(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Enfermero)
  @Patch('beds/:id/status')
  changeStatus(@Param('id') id: string, @Body() dto: ChangeBedStatusDto) {
    return this.beds.changeStatus(id, dto.status);
  }
}
