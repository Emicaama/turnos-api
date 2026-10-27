import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateTriageDto } from './dto/create-triage.dto';
import { ListTriageQueryDto } from './dto/list-triage-query.dto';
import { TriageService } from './triage.service';

@ApiTags('triage')
@ApiBearerAuth()
@Controller('triage')
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Secretaria)
  @Post()
  classify(@Body() dto: CreateTriageDto) {
    return this.triageService.classify(dto);
  }

  @Get()
  queue(@Query() query: ListTriageQueryDto) {
    return this.triageService.queue(query.branchId);
  }
}
