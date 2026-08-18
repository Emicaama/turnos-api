import {
  IsArray,
  IsMongoId,
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
  @IsMongoId()
  userId?: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  specialtyIds?: string[];

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  branchIds?: string[];
}
