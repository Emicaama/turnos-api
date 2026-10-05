import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Appointment, Prisma, WaitlistEntry } from '@prisma/client';
import type { AuthUser } from '../auth/auth-user';
import { AvailabilityService } from '../availability/availability.service';
import { clinicDay, clockMinute } from '../availability/time-in-zone';
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
import { lockAgenda } from './agenda-lock';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ListAppointmentsQueryDto } from './dto/list-appointments-query.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { isEntreturnoStart } from './entreturno';
import { decideSlot } from './slot-decision';
import {
  canReschedule,
  canTransition,
  statusNote,
  transitionError,
} from './status-transitions';

export type BookingResult =
  | {
      result: 'programado';
      appointment: Appointment;
      acortado?: Appointment;
    }
  | { result: 'lista_de_espera'; waitlist: WaitlistEntry };

type Slot = {
  professionalId: string;
  branchId: string;
  startAt: Date;
  endAt: Date;
};

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patientsService: PatientsService,
    private readonly professionalsService: ProfessionalsService,
    private readonly branchesService: BranchesService,
    private readonly availabilityService: AvailabilityService,
    @Inject(NOTIFICATION_PORT)
    private readonly notifications: NotificationPort,
    private readonly config: ConfigService,
  ) {}

  async create(
    dto: CreateAppointmentDto,
    actor: AuthUser,
  ): Promise<BookingResult> {
    this.assertCanCreate(actor);
    const range = this.parseRange(dto.startAt, dto.endAt);
    await this.assertCatalog(dto.patientId, dto.professionalId, dto.branchId);
    await this.assertAvailability(
      dto.professionalId,
      dto.branchId,
      range.startAt,
      range.endAt,
    );

    if (dto.entreturno) {
      return this.createEntreturno(dto, range, actor);
    }
    return this.bookOrWait(dto, range, actor);
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
    if (dto.startAt || dto.endAt) {
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

  private async bookOrWait(
    dto: CreateAppointmentDto,
    range: { startAt: Date; endAt: Date },
    actor: AuthUser,
  ): Promise<BookingResult> {
    const slot = {
      professionalId: dto.professionalId,
      branchId: dto.branchId,
      ...range,
    };
    const seenFree = !(await this.findOverlap(this.prisma, slot));

    const booked = await this.withAgendaLock(
      slot.professionalId,
      slot.branchId,
      async (tx) => {
        const freeInsideLock = !(await this.findOverlap(tx, slot));
        const decision = decideSlot(seenFree, freeInsideLock);
        if (decision === 'recien_ocupado') {
          throw new ConflictException('El turno acaba de ser ocupado');
        }
        if (decision === 'lista_de_espera') {
          const waitlist = await this.enqueue(tx, dto, range.startAt);
          return { result: 'lista_de_espera' as const, waitlist };
        }
        const appointment = await tx.appointment.create({
          data: {
            patientId: dto.patientId,
            professionalId: dto.professionalId,
            branchId: dto.branchId,
            startAt: range.startAt,
            endAt: range.endAt,
            status: AppointmentStatus.Programado,
            notes: dto.notes,
          },
        });
        await this.writeNote(tx, appointment.id, actor.name, 'Creó el turno');
        return { result: 'programado' as const, appointment };
      },
    );

    if (booked.result === 'lista_de_espera') {
      await this.notifications.notify({
        type: 'waitlist_joined',
        appointmentId: booked.waitlist.id,
        professionalId: dto.professionalId,
        patientId: dto.patientId,
        message:
          'No había horario libre. El paciente quedó en la lista de espera',
      });
      return booked;
    }

    await this.notifications.notify({
      type: 'created',
      appointmentId: booked.appointment.id,
      professionalId: dto.professionalId,
      patientId: dto.patientId,
      message: 'Turno programado',
    });
    return booked;
  }

  private async createEntreturno(
    dto: CreateAppointmentDto,
    range: { startAt: Date; endAt: Date },
    actor: AuthUser,
  ): Promise<BookingResult> {
    const minute = clockMinute(range.startAt, this.timeZone());
    if (!isEntreturnoStart(minute)) {
      throw new BadRequestException(
        'Un entreturno solo puede empezar a los :15 o a los :45',
      );
    }

    const { appointment, acortado } = await this.withAgendaLock(
      dto.professionalId,
      dto.branchId,
      async (tx) => {
        const neighbor = await tx.appointment.findFirst({
          where: {
            professionalId: dto.professionalId,
            branchId: dto.branchId,
            status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
            startAt: { lt: range.startAt },
            endAt: { gt: range.startAt },
          },
        });
        if (!neighbor) {
          throw new BadRequestException(
            'No hay un turno en curso para acortar en ese horario',
          );
        }
        if (neighbor.endAt.getTime() !== range.endAt.getTime()) {
          throw new BadRequestException(
            'El entreturno tiene que terminar cuando terminaba el turno que se acorta',
          );
        }

        const shortened = await tx.appointment.update({
          where: { id: neighbor.id },
          data: { endAt: range.startAt, acortado: true },
        });
        const created = await tx.appointment.create({
          data: {
            patientId: dto.patientId,
            professionalId: dto.professionalId,
            branchId: dto.branchId,
            startAt: range.startAt,
            endAt: range.endAt,
            status: AppointmentStatus.Programado,
            entreturno: true,
            notes: dto.notes,
          },
        });
        await this.writeNote(
          tx,
          shortened.id,
          actor.name,
          'Se acortó por un entreturno',
        );
        await this.writeNote(tx, created.id, actor.name, 'Creó un entreturno');
        return { appointment: created, acortado: shortened };
      },
    );

    await this.notifications.notify({
      type: 'created',
      appointmentId: appointment.id,
      professionalId: dto.professionalId,
      patientId: dto.patientId,
      message: 'Entreturno programado',
    });
    await this.notifications.notify({
      type: 'status_changed',
      appointmentId: acortado.id,
      professionalId: acortado.professionalId,
      patientId: acortado.patientId,
      message: 'Turno acortado por un entreturno',
    });
    return { result: 'programado', appointment, acortado };
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
    await this.assertAvailability(
      current.professionalId,
      current.branchId,
      startAt,
      endAt,
    );

    const { created, promoted } = await this.withAgendaLock(
      current.professionalId,
      current.branchId,
      async (tx) => {
        const fresh = await tx.appointment.findUnique({
          where: { id: current.id },
        });
        if (!fresh || !canReschedule(fresh.status as AppointmentStatus)) {
          throw new BadRequestException('Este turno no se puede reprogramar');
        }
        const clash = await this.findOverlap(tx, {
          professionalId: fresh.professionalId,
          branchId: fresh.branchId,
          startAt,
          endAt,
          excludeId: fresh.id,
        });
        if (clash) {
          throw new ConflictException(
            'El profesional ya tiene un turno activo en ese horario',
          );
        }
        await tx.appointment.update({
          where: { id: fresh.id },
          data: { status: AppointmentStatus.Cancelado },
        });
        await this.writeNote(tx, fresh.id, actor.name, 'Reprogramó el turno');
        const next = await tx.appointment.create({
          data: {
            patientId: fresh.patientId,
            professionalId: fresh.professionalId,
            branchId: fresh.branchId,
            startAt,
            endAt,
            status: AppointmentStatus.Programado,
            notes: dto.notes ?? fresh.notes,
          },
        });
        await this.writeNote(
          tx,
          next.id,
          actor.name,
          'Creó el turno reprogramado',
        );
        const filled = await this.promoteFirst(tx, fresh, actor);
        return { created: next, promoted: filled };
      },
    );

    await this.notifications.notify({
      type: 'rescheduled',
      appointmentId: created.id,
      professionalId: current.professionalId,
      patientId: current.patientId,
      message: `Reprogramado desde ${current.id}`,
    });
    await this.notifyPromoted(promoted);
    return promoted ? { ...created, promoted } : created;
  }

  private async changeStatus(
    current: Appointment,
    next: AppointmentStatus,
    actor: AuthUser,
  ) {
    if (
      actor.role === Role.Profesional &&
      next !== AppointmentStatus.Atendido
    ) {
      throw new ForbiddenException(
        'El profesional solo puede marcar el turno como atendido',
      );
    }
    this.assertTransition(current.status as AppointmentStatus, next);

    if (next !== AppointmentStatus.Cancelado) {
      const updated = await this.prisma.appointment.update({
        where: { id: current.id },
        data: { status: next },
      });
      await this.prisma.binnacleRecord.create({
        data: {
          appointmentId: updated.id,
          authorName: actor.name,
          text: statusNote(next),
        },
      });
      await this.notifyStatus(updated, next);
      return updated;
    }

    const { updated, promoted } = await this.withAgendaLock(
      current.professionalId,
      current.branchId,
      async (tx) => {
        const fresh = await tx.appointment.findUnique({
          where: { id: current.id },
        });
        if (!fresh) {
          throw new NotFoundException('Turno no encontrado');
        }
        this.assertTransition(fresh.status as AppointmentStatus, next);
        const cancelled = await tx.appointment.update({
          where: { id: fresh.id },
          data: { status: AppointmentStatus.Cancelado },
        });
        await this.writeNote(tx, cancelled.id, actor.name, statusNote(next));
        const filled = await this.promoteFirst(tx, cancelled, actor);
        return { updated: cancelled, promoted: filled };
      },
    );

    await this.notifyStatus(updated, next);
    await this.notifyPromoted(promoted);
    return promoted ? { ...updated, promoted } : updated;
  }

  private async enqueue(
    tx: Prisma.TransactionClient,
    dto: CreateAppointmentDto,
    startAt: Date,
  ): Promise<WaitlistEntry> {
    const day = clinicDay(startAt, this.timeZone());
    const existing = await tx.waitlistEntry.findFirst({
      where: {
        patientId: dto.patientId,
        professionalId: dto.professionalId,
        branchId: dto.branchId,
        day,
        promotedAppointmentId: null,
      },
    });
    if (existing) {
      return existing;
    }
    return tx.waitlistEntry.create({
      data: {
        patientId: dto.patientId,
        professionalId: dto.professionalId,
        branchId: dto.branchId,
        day,
      },
    });
  }

  private async promoteFirst(
    tx: Prisma.TransactionClient,
    freed: Appointment,
    actor: AuthUser,
  ): Promise<Appointment | null> {
    const clash = await this.findOverlap(tx, {
      professionalId: freed.professionalId,
      branchId: freed.branchId,
      startAt: freed.startAt,
      endAt: freed.endAt,
    });
    if (clash) {
      return null;
    }
    const day = clinicDay(freed.startAt, this.timeZone());
    const entry = await tx.waitlistEntry.findFirst({
      where: {
        professionalId: freed.professionalId,
        branchId: freed.branchId,
        day,
        promotedAppointmentId: null,
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!entry) {
      return null;
    }
    const appointment = await tx.appointment.create({
      data: {
        patientId: entry.patientId,
        professionalId: freed.professionalId,
        branchId: freed.branchId,
        startAt: freed.startAt,
        endAt: freed.endAt,
        status: AppointmentStatus.Programado,
        notes: 'Asignado desde la lista de espera',
      },
    });
    await tx.waitlistEntry.update({
      where: { id: entry.id },
      data: { promotedAppointmentId: appointment.id },
    });
    await this.writeNote(
      tx,
      appointment.id,
      actor.name,
      'Asignó el horario liberado desde la lista de espera',
    );
    await this.writeNote(
      tx,
      freed.id,
      actor.name,
      'El horario pasó al primero de la lista de espera',
    );
    return appointment;
  }

  private async findOverlap(
    db: PrismaService | Prisma.TransactionClient,
    slot: Slot & { excludeId?: string },
  ): Promise<Appointment | null> {
    return db.appointment.findFirst({
      where: {
        professionalId: slot.professionalId,
        branchId: slot.branchId,
        status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
        startAt: { lt: slot.endAt },
        endAt: { gt: slot.startAt },
        ...(slot.excludeId ? { id: { not: slot.excludeId } } : {}),
      },
    });
  }

  private withAgendaLock<T>(
    professionalId: string,
    branchId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        await lockAgenda(tx, professionalId, branchId);
        return fn(tx);
      },
      { timeout: 15_000 },
    );
  }

  private writeNote(
    tx: Prisma.TransactionClient,
    appointmentId: string,
    authorName: string,
    text: string,
  ) {
    return tx.binnacleRecord.create({
      data: { appointmentId, authorName, text },
    });
  }

  private async notifyStatus(updated: Appointment, next: AppointmentStatus) {
    const enSala = next === AppointmentStatus.EnSalaDeEspera;
    await this.notifications.notify({
      type:
        next === AppointmentStatus.Cancelado ? 'cancelled' : 'status_changed',
      appointmentId: updated.id,
      professionalId: updated.professionalId,
      patientId: updated.patientId,
      message: enSala
        ? 'Paciente en sala de espera. Avisar al consultorio.'
        : `Estado: ${next}`,
    });
  }

  private async notifyPromoted(promoted: Appointment | null) {
    if (!promoted) {
      return;
    }
    await this.notifications.notify({
      type: 'waitlist_promoted',
      appointmentId: promoted.id,
      professionalId: promoted.professionalId,
      patientId: promoted.patientId,
      message:
        'Lista de espera: avisar al paciente. Quedó programado en el horario liberado',
    });
  }

  private assertTransition(from: AppointmentStatus, to: AppointmentStatus) {
    if (!canTransition(from, to)) {
      throw new BadRequestException(transitionError(from, to));
    }
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
    const covers = await this.availabilityService.coversSlot({
      professionalId,
      branchId,
      startAt,
      endAt,
      timeZone: this.timeZone(),
    });
    if (!covers) {
      throw new BadRequestException(
        'El horario está fuera de la disponibilidad del profesional',
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

  private timeZone() {
    return this.config.get<string>('CLINIC_TZ') ?? 'UTC';
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
}
