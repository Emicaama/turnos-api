import { ProfessionalStatus } from '@prisma/client';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsUUID,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateProfessionalDto {
  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  specialtyIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  branchIds?: string[];

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  office?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(ProfessionalStatus)
  status?: ProfessionalStatus;
}
