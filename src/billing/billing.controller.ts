import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { BillingService } from './billing.service';
import { ChargeConsultationDto } from './dto/charge-consultation.dto';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(Role.Admin, Role.Secretaria)
@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post('appointments/:id/charges')
  chargeConsultation(
    @Param('id') id: string,
    @Body() dto: ChargeConsultationDto,
  ) {
    return this.billing.chargeConsultation(id, dto.price);
  }

  @Get('admissions/:id/account')
  stayAccount(@Param('id') id: string) {
    return this.billing.stayAccount(id);
  }
}
