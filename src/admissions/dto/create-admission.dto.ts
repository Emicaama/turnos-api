import { AdmissionReason } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class CreateAdmissionDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  bedId: string;

  @IsEnum(AdmissionReason)
  reason: AdmissionReason;
}
