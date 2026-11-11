import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateAvailabilityDto } from './create-availability.dto';

export class UpdateAvailabilityDto extends PartialType(
  OmitType(CreateAvailabilityDto, ['professionalId'] as const),
) {}
