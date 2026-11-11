import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BinnacleService } from './binnacle.service';
import { ListBinnacleQueryDto } from './dto/list-binnacle-query.dto';

@ApiTags('binnacle')
@ApiBearerAuth()
@Controller('binnacle')
export class BinnacleController {
  constructor(private readonly binnacle: BinnacleService) {}

  @Get(':appointmentId')
  list(
    @Param('appointmentId') appointmentId: string,
    @Query() query: ListBinnacleQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.binnacle.list(appointmentId, user, query.kind);
  }
}
