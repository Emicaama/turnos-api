import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { normalizeReason } from '../protocols';

export class CreateAdmissionDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  bedId: string;

  @IsOptional()
  @Transform(({ value }) => normalizeReason(value))
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsUUID()
  treatingProfessionalId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
