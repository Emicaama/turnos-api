import { IsIn, IsUUID } from 'class-validator';
import { TRIAGE_LEVELS, type TriageLevel } from '../triage';

export class CreateTriageDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  branchId: string;

  @IsIn(TRIAGE_LEVELS)
  level: TriageLevel;
}
