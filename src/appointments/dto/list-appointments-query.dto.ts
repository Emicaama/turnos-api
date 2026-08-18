import { IsDateString, IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { AppointmentStatus } from '../../common/enums/appointment-status.enum';

export class ListAppointmentsQueryDto {
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @IsOptional()
  @IsMongoId()
  professionalId?: string;

  @IsOptional()
  @IsMongoId()
  branchId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
