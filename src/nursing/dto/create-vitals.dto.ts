import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateVitalsDto {
  @IsInt()
  @Min(1)
  sistolica: number;

  @IsInt()
  @Min(1)
  diastolica: number;

  @IsInt()
  @Min(1)
  frecuenciaCardiaca: number;

  @IsNumber()
  @Min(0)
  temperatura: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
