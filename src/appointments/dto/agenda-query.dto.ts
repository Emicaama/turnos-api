import { IsDateString } from 'class-validator';

export class AgendaQueryDto {
  @IsDateString()
  from: string;

  @IsDateString()
  to: string;
}
