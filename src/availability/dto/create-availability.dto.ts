import { AvailabilityModality, AvailabilityStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateAvailabilityDto {
  @IsUUID()
  professionalId: string;

  @IsUUID()
  branchId: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime: string;

  @Type(() => Number)
  @IsInt()
  @Min(5)
  slotMinutes: number;

  @IsOptional()
  @IsString()
  room?: string;

  @IsOptional()
  @IsEnum(AvailabilityModality)
  modality?: AvailabilityModality;

  @IsOptional()
  @IsEnum(AvailabilityStatus)
  status?: AvailabilityStatus;
}
