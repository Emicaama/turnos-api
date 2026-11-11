import { IsInt, IsString, IsUUID, Min } from 'class-validator';

export class CreatePrescriptionDto {
  @IsUUID()
  supplyId: string;

  @IsString()
  dosis: string;

  @IsInt()
  @Min(1)
  cadaHoras: number;
}
