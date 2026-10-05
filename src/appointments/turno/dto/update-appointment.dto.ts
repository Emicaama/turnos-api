import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { AppointmentStatus } from '../../../common/enums/appointment-status.enum';

export class UpdateAppointmentDto {
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
