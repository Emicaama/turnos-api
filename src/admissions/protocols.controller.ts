import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateProtocolDto } from './dto/create-protocol.dto';
import { ProtocolsService } from './protocols.service';

@ApiTags('protocols')
@ApiBearerAuth()
@Controller('protocols')
export class ProtocolsController {
  constructor(private readonly protocols: ProtocolsService) {}

  @Get()
  list() {
    return this.protocols.list();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Profesional)
  @Post()
  create(@Body() dto: CreateProtocolDto) {
    return this.protocols.create(dto);
  }
}
