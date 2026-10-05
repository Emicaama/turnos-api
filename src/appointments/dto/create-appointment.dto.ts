import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateAppointmentDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  professionalId: string;

  @IsUUID()
  branchId: string;

  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  entreturno?: boolean;
}
