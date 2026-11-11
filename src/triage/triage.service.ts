import { Inject, Injectable } from '@nestjs/common';
import { BranchesService } from '../branches/branches.service';
import { NOTIFICATION_PORT } from '../notifications/notification.port';
import type { NotificationPort } from '../notifications/notification.port';
import { PatientsService } from '../patients/patients.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTriageDto } from './dto/create-triage.dto';
import { byRiskThenArrival, isVitalRisk } from './triage';

@Injectable()
export class TriageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patients: PatientsService,
    private readonly branches: BranchesService,
    @Inject(NOTIFICATION_PORT)
    private readonly notifications: NotificationPort,
  ) {}

  async classify(dto: CreateTriageDto) {
    await Promise.all([
      this.patients.findById(dto.patientId),
      this.branches.findById(dto.branchId),
    ]);
    const entry = await this.prisma.triageEntry.create({ data: dto });
    if (isVitalRisk(dto.level)) {
      await this.notifications.notify({
        type: 'guardia',
        patientId: dto.patientId,
        branchId: dto.branchId,
        message: 'Riesgo vital (código rojo). Avisar a los médicos de guardia.',
      });
    }
    return entry;
  }

  async queue(branchId: string) {
    await this.branches.findById(branchId);
    const entries = await this.prisma.triageEntry.findMany({
      where: { branchId },
    });
    return entries.sort(byRiskThenArrival);
  }
}
