import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { BinnacleKind } from '@prisma/client';
import type { AuthUser } from '../auth/auth-user';
import { Role } from '../common/enums/role.enum';
import { PrismaService } from '../prisma/prisma.service';

const CLINICAL_KINDS: BinnacleKind[] = ['signos', 'medicacion'];

@Injectable()
export class BinnacleService {
  constructor(private readonly prisma: PrismaService) {}

  async list(appointmentId: string, actor: AuthUser, kind?: BinnacleKind) {
    if (actor.role === Role.Profesional) {
      await this.assertProfessionalCanRead(appointmentId, actor, kind);
    }
    return this.prisma.binnacleRecord.findMany({
      where: { appointmentId, kind },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async assertProfessionalCanRead(
    appointmentId: string,
    actor: AuthUser,
    kind?: BinnacleKind,
  ) {
    if (!kind || !CLINICAL_KINDS.includes(kind)) {
      throw new ForbiddenException('No podés leer la bitácora de la agenda');
    }
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment) {
      throw new NotFoundException('Turno no encontrado');
    }
    if (actor.professionalId !== appointment.professionalId) {
      throw new ForbiddenException('No podés ver turnos de otro profesional');
    }
  }
}
