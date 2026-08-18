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
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { UpdateProfessionalDto } from './dto/update-professional.dto';
import { ProfessionalsService } from './professionals.service';

@ApiTags('professionals')
@ApiBearerAuth()
@Controller('professionals')
export class ProfessionalsController {
  constructor(private readonly professionalsService: ProfessionalsService) {}

  @Get()
  list() {
    return this.professionalsService.list();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.professionalsService.findById(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Post()
  create(@Body() dto: CreateProfessionalDto) {
    return this.professionalsService.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProfessionalDto) {
    return this.professionalsService.update(id, dto);
  }
}
