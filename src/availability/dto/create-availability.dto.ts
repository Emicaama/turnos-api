import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsString, Matches, Max, Min } from 'class-validator';

export class CreateAvailabilityDto {
  @IsMongoId()
  professionalId: string;

  @IsMongoId()
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
}
