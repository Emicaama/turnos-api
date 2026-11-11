import { IsInt, Min } from 'class-validator';

export class ChargeConsultationDto {
  @IsInt()
  @Min(0)
  price: number;
}
