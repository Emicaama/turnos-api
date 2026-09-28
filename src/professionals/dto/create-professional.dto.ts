import {
  IsArray,
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
}
