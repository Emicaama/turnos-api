import { IsDateString, IsUUID } from 'class-validator';

export class GiveDoseDto {
  @IsUUID()
  indicacionId: string;

  @IsDateString()
  horaIndicada: string;

  @IsDateString()
  administradaEn: string;
}
