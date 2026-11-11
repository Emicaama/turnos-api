import { BedStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ChangeBedStatusDto {
  @IsEnum(BedStatus)
  status: BedStatus;
}
