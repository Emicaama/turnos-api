import { TriageLevel } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class CreateTriageDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  branchId: string;

  @IsEnum(TriageLevel)
  level: TriageLevel;
}
