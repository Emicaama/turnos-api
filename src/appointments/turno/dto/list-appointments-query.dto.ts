import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AppointmentStatus } from '../../../common/enums/appointment-status.enum';

export class ListAppointmentsQueryDto {
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @IsOptional()
  @IsUUID()
  professionalId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
