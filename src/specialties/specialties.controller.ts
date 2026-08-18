import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateSpecialtyDto } from './dto/create-specialty.dto';
import { SpecialtiesService } from './specialties.service';

@ApiTags('specialties')
@ApiBearerAuth()
@Controller('specialties')
export class SpecialtiesController {
  constructor(private readonly specialtiesService: SpecialtiesService) {}

  @Get()
  list() {
    return this.specialtiesService.list();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.specialtiesService.findById(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Post()
  create(@Body() dto: CreateSpecialtyDto) {
    return this.specialtiesService.create(dto);
  }
}
