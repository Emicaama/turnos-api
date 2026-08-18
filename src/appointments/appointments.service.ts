import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Appointment,
  AppointmentStatus as PrismaAppointmentStatus,
  Prisma,
} from '@prisma/client';
import type { AuthUser } from '../auth/auth-user';
import { AuditService } from '../audit/audit.service';
import { AvailabilityService } from '../availability/availability.service';
import { BranchesService } from '../branches/branches.service';
import {
  ACTIVE_APPOINTMENT_STATUSES,
  AppointmentStatus,
} from '../common/enums/appointment-status.enum';
import { Role } from '../common/enums/role.enum';
import { NOTIFICATION_PORT } from '../notifications/notification.port';
import type { NotificationPort } from '../notifications/notification.port';
import { PatientsService } from '../patients/patients.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProfessionalsService } from '../professionals/professionals.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ListAppointmentsQueryDto } from './dto/list-appointments-query.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { canReschedule, canTransition } from './status-transitions';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patientsService: PatientsService,
    private readonly professionalsService: ProfessionalsService,
    private readonly branchesService: BranchesService,
    private readonly availabilityService: AvailabilityService,
    private readonly auditService: AuditService,
    @Inject(NOTIFICATION_PORT)
    private readonly notifications: NotificationPort,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateAppointmentDto, actor: AuthUser) {
    this.assertCanCreate(actor);
    const { startAt, endAt } = this.parseRange(dto.startAt, dto.endAt);
    await this.assertCatalog(dto.patientId, dto.professionalId, dto.branchId);
    await this.assertAvailability(
      dto.professionalId,
      dto.branchId,
      startAt,
      endAt,
    );
    await this.assertNoOverlap(
      dto.professionalId,
      dto.branchId,
      startAt,
      endAt,
    );

    const appointment = await this.prisma.appointment.create({
      data: {
        patientId: dto.patientId,
        professionalId: dto.professionalId,
        branchId: dto.branchId,
        startAt,
        endAt,
        status: AppointmentStatus.Pendiente,
        notes: dto.notes,
      },
    });

    await this.auditService.record({
      actorId: actor.id,
      action: 'create',
      entity: 'appointment',
      entityId: appointment.id,
      after: this.snapshot(appointment),
    });
    await this.notifications.notify({
      type: 'created',
      appointmentId: appointment.id,
      professionalId: dto.professionalId,
      patientId: dto.patientId,
      message: 'Turno creado en estado pendiente',
    });
    return appointment;
  }

  async list(query: ListAppointmentsQueryDto, actor: AuthUser) {
    const where: Prisma.AppointmentWhereInput = {};
    if (actor.role === Role.Profesional) {
      if (!actor.professionalId) {
        throw new ForbiddenException('El profesional no está vinculado');
      }
      where.professionalId = actor.professionalId;
    } else if (query.professionalId) {
      where.professionalId = query.professionalId;
    }
    if (query.branchId) {
      where.branchId = query.branchId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.from || query.to) {
      where.startAt = {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      };
    }
    return this.prisma.appointment.findMany({
      where,
      orderBy: { startAt: 'asc' },
    });
  }

  async agenda(
    professionalId: string,
    from: string,
    to: string,
    actor: AuthUser,
  ) {
    if (
      actor.role === Role.Profesional &&
      actor.professionalId !== professionalId
    ) {
      throw new ForbiddenException('Solo podés ver tu propia agenda');
    }
    await this.professionalsService.findById(professionalId);
    return this.prisma.appointment.findMany({
      where: {
        professionalId,
        startAt: { gte: new Date(from), lte: new Date(to) },
        status: { not: AppointmentStatus.Cancelado },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  async findById(id: string, actor: AuthUser): Promise<Appointment> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });
    if (!appointment) {
      throw new NotFoundException('Turno no encontrado');
    }
    this.assertCanView(appointment, actor);
    return appointment;
  }

  async update(id: string, dto: UpdateAppointmentDto, actor: AuthUser) {
    const current = await this.findById(id, actor);
    const wantsReschedule = Boolean(dto.startAt || dto.endAt);
    if (wantsReschedule) {
      return this.reschedule(current, dto, actor);
    }
    if (dto.status) {
      return this.changeStatus(current, dto.status, actor);
    }
    if (dto.notes !== undefined) {
      return this.prisma.appointment.update({
        where: { id: current.id },
        data: { notes: dto.notes },
      });
    }
    return current;
  }

  async cancel(id: string, actor: AuthUser) {
    const current = await this.findById(id, actor);
    if (actor.role === Role.Profesional) {
      throw new ForbiddenException('El profesional no cancela turnos');
    }
    return this.changeStatus(current, AppointmentStatus.Cancelado, actor);
  }

  private async reschedule(
    current: Appointment,
    dto: UpdateAppointmentDto,
    actor: AuthUser,
  ) {
    if (actor.role === Role.Profesional) {
      throw new ForbiddenException('El profesional no reprograma turnos');
    }
    if (!canReschedule(current.status as AppointmentStatus)) {
      throw new BadRequestException('Este turno no se puede reprogramar');
    }
    const startAt = dto.startAt ? new Date(dto.startAt) : current.startAt;
    const endAt = dto.endAt ? new Date(dto.endAt) : current.endAt;
    this.parseRange(startAt.toISOString(), endAt.toISOString());

    const cancelled = await this.changeStatus(
      current,
      AppointmentStatus.Cancelado,
      actor,
    );
    const created = await this.create(
      {
        patientId: current.patientId,
        professionalId: current.professionalId,
        branchId: current.branchId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        notes: dto.notes ?? current.notes ?? undefined,
      },
      actor,
    );
    await this.notifications.notify({
      type: 'rescheduled',
      appointmentId: created.id,
      professionalId: current.professionalId,
      patientId: current.patientId,
      message: `Reprogramado desde ${cancelled.id}`,
    });
    return created;
  }

  private async changeStatus(
    current: Appointment,
    next: AppointmentStatus,
    actor: AuthUser,
  ) {
    if (actor.role === Role.Profesional) {
      const allowed = [
        AppointmentStatus.Confirmado,
        AppointmentStatus.Completado,
        AppointmentStatus.Ausente,
      ];
      if (!allowed.includes(next)) {
        throw new ForbiddenException(
          'Transición no permitida para el profesional',
        );
      }
    }
    if (!canTransition(current.status as AppointmentStatus, next)) {
      throw new BadRequestException(
        `No se puede pasar de ${current.status} a ${next}`,
      );
    }
    const before = this.snapshot(current);
    const updated = await this.prisma.appointment.update({
      where: { id: current.id },
      data: { status: next as PrismaAppointmentStatus },
    });
    await this.auditService.record({
      actorId: actor.id,
      action: next === AppointmentStatus.Cancelado ? 'cancel' : 'status_change',
      entity: 'appointment',
      entityId: updated.id,
      before,
      after: this.snapshot(updated),
    });
    await this.notifications.notify({
      type:
        next === AppointmentStatus.Cancelado ? 'cancelled' : 'status_changed',
      appointmentId: updated.id,
      professionalId: updated.professionalId,
      patientId: updated.patientId,
      message: `Estado: ${next}`,
    });
    return updated;
  }

  private async assertCatalog(
    patientId: string,
    professionalId: string,
    branchId: string,
  ) {
    const [professional] = await Promise.all([
      this.professionalsService.findById(professionalId),
      this.patientsService.findById(patientId),
      this.branchesService.findById(branchId),
    ]);
    const worksHere = professional.branchIds.includes(branchId);
    if (professional.branchIds.length > 0 && !worksHere) {
      throw new BadRequestException(
        'El profesional no atiende en esa sucursal',
      );
    }
  }

  private async assertAvailability(
    professionalId: string,
    branchId: string,
    startAt: Date,
    endAt: Date,
  ) {
    const timeZone = this.config.get<string>('CLINIC_TZ') ?? 'UTC';
    const covers = await this.availabilityService.coversSlot({
      professionalId,
      branchId,
      startAt,
      endAt,
      timeZone,
    });
    if (!covers) {
      throw new BadRequestException(
        'El horario está fuera de la disponibilidad del profesional',
      );
    }
  }

  private async assertNoOverlap(
    professionalId: string,
    branchId: string,
    startAt: Date,
    endAt: Date,
    excludeId?: string,
  ) {
    const conflict = await this.prisma.appointment.findFirst({
      where: {
        professionalId,
        branchId,
        status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (conflict) {
      throw new ConflictException(
        'El profesional ya tiene un turno activo en ese horario',
      );
    }
  }

  private parseRange(startIso: string, endIso: string) {
    const startAt = new Date(startIso);
    const endAt = new Date(endIso);
    if (!(startAt < endAt)) {
      throw new BadRequestException('endAt debe ser posterior a startAt');
    }
    return { startAt, endAt };
  }

  private assertCanCreate(actor: AuthUser) {
    if (actor.role === Role.Profesional) {
      throw new ForbiddenException('El profesional no crea turnos ajenos');
    }
  }

  private assertCanView(appointment: Appointment, actor: AuthUser) {
    if (actor.role !== Role.Profesional) {
      return;
    }
    if (actor.professionalId !== appointment.professionalId) {
      throw new ForbiddenException('No podés ver turnos de otro profesional');
    }
  }

  private snapshot(appointment: Appointment): Record<string, unknown> {
    return {
      patientId: appointment.patientId,
      professionalId: appointment.professionalId,
      branchId: appointment.branchId,
      startAt: appointment.startAt.toISOString(),
      endAt: appointment.endAt.toISOString(),
      status: appointment.status,
      notes: appointment.notes,
    };
  }
}
