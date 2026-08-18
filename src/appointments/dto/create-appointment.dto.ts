import { IsDateString, IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateAppointmentDto {
  @IsMongoId()
  patientId: string;

  @IsMongoId()
  professionalId: string;

  @IsMongoId()
  branchId: string;

  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
