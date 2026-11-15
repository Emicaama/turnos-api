import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class UpdateBedDto {
  @IsOptional()
  @IsUUID()
  wingId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  sala?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  habitacion?: string;
}
