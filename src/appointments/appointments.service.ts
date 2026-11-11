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
  Prisma,
  ProfessionalStatus,
  WaitlistEntry,
} from '@prisma/client';
import type { AuthUser } from '../auth/auth-user';
import { AvailabilityService } from '../availability/availability.service';
import { clinicDay, clockMinute } from '../availability/time-in-zone';
import { addBinnacleNote } from '../binnacle/binnacle-note';
import { BranchesService } from '../branches/branches.service';
import {
  ACTIVE_APPOINTMENT_STATUSES,
  AppointmentStatus,
} from '../common/enums/appointment-status.enum';
import { Role } from '../common/enums/role.enum';
import { NOTIFICATION_PORT } from '../notifications/notification.port';
import type { NotificationPort } from '../notifications/notification.port';
import { PatientsService } from '../patients/patients.service';
import { isSerializationConflict } from '../prisma/prisma.errors';
import { PrismaService } from '../prisma/prisma.service';
import { ProfessionalsService } from '../professionals/professionals.service';
import {
  canReschedule,
  canTransition,
  findActiveOverlap,
  isEntreturnoStart,
  joinWaitlist,
  parseRange,
  statusNote,
  transitionError,
  type Range,
} from './appointment-rules';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ListAppointmentsQueryDto } from './dto/list-appointments-query.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

export type BookingResult =
  | {
      result: 'programado';
      appointment: Appointment;
      acortado?: Appointment;
    }
  | { result: 'lista_de_espera'; waitlist: WaitlistEntry };

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
    const range = await this.validateNewAppointment(dto, actor);
    return dto.entreturno
      ? this.insertEntreturno(dto, range, actor)
      : this.bookOrJoinWaitlist(dto, range, actor);
  }

  list(query: ListAppointmentsQueryDto, actor: AuthUser) {
    return this.prisma.appointment.findMany({
      where: {
        professionalId: this.visibleProfessionalId(query, actor),
        patientId: query.patientId,
        branchId: query.branchId,
        status: query.status,
        startAt:
          query.from || query.to
            ? {
                gte: query.from ? new Date(query.from) : undefined,
                lte: query.to ? new Date(query.to) : undefined,
              }
            : undefined,
      },
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

  private visibleProfessionalId(
    query: ListAppointmentsQueryDto,
    actor: AuthUser,
  ): string | undefined {
    if (actor.role !== Role.Profesional) {
      return query.professionalId;
    }
    if (!actor.professionalId) {
      throw new ForbiddenException('El profesional no está vinculado');
    }
    return actor.professionalId;
  }

  private async validateNewAppointment(
    dto: CreateAppointmentDto,
    actor: AuthUser,
  ): Promise<Range> {
    if (actor.role === Role.Profesional) {
      throw new ForbiddenException('El profesional no crea turnos ajenos');
    }
    const range = parseRange(dto.startAt, dto.endAt);
    await this.assertCatalogExists(
      dto.patientId,
      dto.professionalId,
      dto.branchId,
    );
    await this.assertAvailability(dto.professionalId, dto.branchId, range);
    return range;
  }

  private async bookOrJoinWaitlist(
    dto: CreateAppointmentDto,
    range: Range,
    actor: AuthUser,
  ): Promise<BookingResult> {
    const booking = await this.runBooking(async (tx) => {
      const slotTaken = await findActiveOverlap(tx, {
        professionalId: dto.professionalId,
        branchId: dto.branchId,
        ...range,
      });
      if (slotTaken) {
        const waitlist = await joinWaitlist(tx, {
          patientId: dto.patientId,
          professionalId: dto.professionalId,
          branchId: dto.branchId,
          day: clinicDay(range.startAt, this.clinicTimeZone()),
        });
        return { result: 'lista_de_espera' as const, waitlist };
      }
      const appointment = await tx.appointment.create({
        data: {
          patientId: dto.patientId,
          professionalId: dto.professionalId,
          branchId: dto.branchId,
          ...range,
          status: AppointmentStatus.Programado,
          notes: dto.notes,
        },
      });
      await addBinnacleNote(tx, appointment.id, actor.name, 'Creó el turno');
      return { result: 'programado' as const, appointment };
    });

    await this.notifications.notify(
      booking.result === 'lista_de_espera'
        ? {
            type: 'waitlist_joined',
            appointmentId: booking.waitlist.id,
            professionalId: dto.professionalId,
            patientId: dto.patientId,
            message:
              'No había horario libre. El paciente quedó en la lista de espera',
          }
        : {
            type: 'created',
            appointmentId: booking.appointment.id,
            professionalId: dto.professionalId,
            patientId: dto.patientId,
            message: 'Turno programado',
          },
    );
    return booking;
  }

  private async insertEntreturno(
    dto: CreateAppointmentDto,
    range: Range,
    actor: AuthUser,
  ): Promise<BookingResult> {
    const minute = clockMinute(range.startAt, this.clinicTimeZone());
    if (!isEntreturnoStart(minute)) {
      throw new BadRequestException(
        'Un entreturno solo puede empezar a los :15 o a los :45',
      );
    }

    const { appointment, acortado } = await this.runBooking(async (tx) => {
      const ongoing = await tx.appointment.findFirst({
        where: {
          professionalId: dto.professionalId,
          branchId: dto.branchId,
          status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
          startAt: { lt: range.startAt },
          endAt: { gt: range.startAt },
        },
      });
      if (!ongoing) {
        throw new BadRequestException(
          'No hay un turno en curso para acortar en ese horario',
        );
      }
      if (ongoing.endAt.getTime() !== range.endAt.getTime()) {
        throw new BadRequestException(
          'El entreturno tiene que terminar cuando terminaba el turno que se acorta',
        );
      }

      const shortened = await tx.appointment.update({
        where: { id: ongoing.id },
        data: { endAt: range.startAt, acortado: true },
      });
      const created = await tx.appointment.create({
        data: {
          patientId: dto.patientId,
          professionalId: dto.professionalId,
          branchId: dto.branchId,
          ...range,
          status: AppointmentStatus.Programado,
          entreturno: true,
          notes: dto.notes,
        },
      });
      await addBinnacleNote(
        tx,
        shortened.id,
        actor.name,
        'Se acortó por un entreturno',
      );
      await addBinnacleNote(tx, created.id, actor.name, 'Creó un entreturno');
      return { appointment: created, acortado: shortened };
    });

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
    this.assertCanReschedule(current);
    const range = parseRange(
      dto.startAt ?? current.startAt,
      dto.endAt ?? current.endAt,
    );
    await this.assertAvailability(
      current.professionalId,
      current.branchId,
      range,
    );

    const { created, promoted } = await this.runBooking(async (tx) => {
      const fresh = await tx.appointment.findUnique({
        where: { id: current.id },
      });
      this.assertCanReschedule(fresh);
      const clash = await findActiveOverlap(tx, {
        professionalId: fresh.professionalId,
        branchId: fresh.branchId,
        ...range,
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
      await addBinnacleNote(tx, fresh.id, actor.name, 'Reprogramó el turno');
      const next = await tx.appointment.create({
        data: {
          patientId: fresh.patientId,
          professionalId: fresh.professionalId,
          branchId: fresh.branchId,
          ...range,
          status: AppointmentStatus.Programado,
          notes: dto.notes ?? fresh.notes,
        },
      });
      await addBinnacleNote(
        tx,
        next.id,
        actor.name,
        'Creó el turno reprogramado',
      );
      const filled = await this.promoteFromWaitlist(tx, fresh, actor);
      return { created: next, promoted: filled };
    });

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
      await addBinnacleNote(
        this.prisma,
        updated.id,
        actor.name,
        statusNote(next),
      );
      await this.notifyStatus(updated, next);
      return updated;
    }

    const { updated, promoted } = await this.runBooking(async (tx) => {
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
      await addBinnacleNote(tx, cancelled.id, actor.name, statusNote(next));
      const filled = await this.promoteFromWaitlist(tx, cancelled, actor);
      return { updated: cancelled, promoted: filled };
    });

    await this.notifyStatus(updated, next);
    await this.notifyPromoted(promoted);
    return promoted ? { ...updated, promoted } : updated;
  }

  private runBooking<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.runSerializable(work).catch((error: unknown) => {
      if (isSerializationConflict(error)) {
        throw new ConflictException('El turno acaba de ser ocupado');
      }
      throw error;
    });
  }

  private async promoteFromWaitlist(
    tx: Prisma.TransactionClient,
    freed: Appointment,
    actor: AuthUser,
  ): Promise<Appointment | null> {
    const stillTaken = await findActiveOverlap(tx, freed);
    if (stillTaken) {
      return null;
    }
    const firstInLine = await tx.waitlistEntry.findFirst({
      where: {
        professionalId: freed.professionalId,
        branchId: freed.branchId,
        day: clinicDay(freed.startAt, this.clinicTimeZone()),
        promotedAppointmentId: null,
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!firstInLine) {
      return null;
    }
    const appointment = await tx.appointment.create({
      data: {
        patientId: firstInLine.patientId,
        professionalId: freed.professionalId,
        branchId: freed.branchId,
        startAt: freed.startAt,
        endAt: freed.endAt,
        status: AppointmentStatus.Programado,
        notes: 'Asignado desde la lista de espera',
      },
    });
    await tx.waitlistEntry.update({
      where: { id: firstInLine.id },
      data: { promotedAppointmentId: appointment.id },
    });
    await addBinnacleNote(
      tx,
      appointment.id,
      actor.name,
      'Asignó el horario liberado desde la lista de espera',
    );
    await addBinnacleNote(
      tx,
      freed.id,
      actor.name,
      'El horario pasó al primero de la lista de espera',
    );
    return appointment;
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

  private async notifyStatus(updated: Appointment, next: AppointmentStatus) {
    const inWaitingRoom = next === AppointmentStatus.EnSalaDeEspera;
    await this.notifications.notify({
      type:
        next === AppointmentStatus.Cancelado ? 'cancelled' : 'status_changed',
      appointmentId: updated.id,
      professionalId: updated.professionalId,
      patientId: updated.patientId,
      message: inWaitingRoom
        ? 'Paciente en sala de espera. Avisar al consultorio.'
        : `Estado: ${next}`,
    });
  }

  private async assertCatalogExists(
    patientId: string,
    professionalId: string,
    branchId: string,
  ) {
    const [professional] = await Promise.all([
      this.professionalsService.findById(professionalId),
      this.patientsService.findById(patientId),
      this.branchesService.findById(branchId),
    ]);
    if (professional.status !== ProfessionalStatus.activo) {
      throw new BadRequestException(
        'El profesional no está habilitado para recibir turnos',
      );
    }
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
    range: Range,
  ) {
    const covers = await this.availabilityService.coversSlot({
      professionalId,
      branchId,
      ...range,
      timeZone: this.clinicTimeZone(),
    });
    if (!covers) {
      throw new BadRequestException(
        'El horario está fuera de la disponibilidad del profesional',
      );
    }
  }

  private assertCanReschedule(
    appointment: Appointment | null,
  ): asserts appointment is Appointment {
    if (
      !appointment ||
      !canReschedule(appointment.status as AppointmentStatus)
    ) {
      throw new BadRequestException('Este turno no se puede reprogramar');
    }
  }

  private assertCanView(appointment: Appointment, actor: AuthUser) {
    if (
      actor.role === Role.Profesional &&
      actor.professionalId !== appointment.professionalId
    ) {
      throw new ForbiddenException('No podés ver turnos de otro profesional');
    }
  }

  private assertTransition(from: AppointmentStatus, to: AppointmentStatus) {
    if (!canTransition(from, to)) {
      throw new BadRequestException(transitionError(from, to));
    }
  }

  private clinicTimeZone() {
    return this.config.get<string>('CLINIC_TZ') ?? 'UTC';
  }
}
