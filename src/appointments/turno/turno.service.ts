import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Appointment, Prisma } from '@prisma/client';
import type { AuthUser } from '../../auth/auth-user';
import { AvailabilityService } from '../../availability/availability.service';
import { BranchesService } from '../../branches/branches.service';
import { AppointmentStatus } from '../../common/enums/appointment-status.enum';
import { Role } from '../../common/enums/role.enum';
import { NOTIFICATION_PORT } from '../../notifications/notification.port';
import type { NotificationPort } from '../../notifications/notification.port';
import { PatientsService } from '../../patients/patients.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfessionalsService } from '../../professionals/professionals.service';
import { ColaService } from '../cola/cola.service';
import { canReschedule } from '../status/status-transitions';
import { findActiveOverlap, withAgendaLock, writeNote } from './agenda';
import type { BookingResult, Range } from './booking-result';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ListAppointmentsQueryDto } from './dto/list-appointments-query.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { decideSlot } from './slot-decision';

@Injectable()
export class TurnoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patientsService: PatientsService,
    private readonly professionalsService: ProfessionalsService,
    private readonly branchesService: BranchesService,
    private readonly availabilityService: AvailabilityService,
    private readonly cola: ColaService,
    @Inject(NOTIFICATION_PORT)
    private readonly notifications: NotificationPort,
    private readonly config: ConfigService,
  ) {}

  async prepare(dto: CreateAppointmentDto, actor: AuthUser): Promise<Range> {
    this.assertCanCreate(actor);
    const range = this.parseRange(dto.startAt, dto.endAt);
    await this.assertCatalog(dto.patientId, dto.professionalId, dto.branchId);
    await this.assertAvailability(
      dto.professionalId,
      dto.branchId,
      range.startAt,
      range.endAt,
    );
    return range;
  }

  async bookOrWait(
    dto: CreateAppointmentDto,
    range: Range,
    actor: AuthUser,
  ): Promise<BookingResult> {
    const slot = {
      professionalId: dto.professionalId,
      branchId: dto.branchId,
      ...range,
    };
    const seenFree = !(await findActiveOverlap(this.prisma, slot));

    const booked = await withAgendaLock(
      this.prisma,
      slot.professionalId,
      slot.branchId,
      async (tx) => {
        const freeInsideLock = !(await findActiveOverlap(tx, slot));
        const decision = decideSlot(seenFree, freeInsideLock);
        if (decision === 'recien_ocupado') {
          throw new ConflictException('El turno acaba de ser ocupado');
        }
        if (decision === 'lista_de_espera') {
          const waitlist = await this.cola.enqueue(tx, dto, range.startAt);
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
        await writeNote(tx, appointment.id, actor.name, 'Creó el turno');
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

  updateNotes(current: Appointment, notes: string) {
    return this.prisma.appointment.update({
      where: { id: current.id },
      data: { notes },
    });
  }

  async reschedule(
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

    const { created, promoted } = await withAgendaLock(
      this.prisma,
      current.professionalId,
      current.branchId,
      async (tx) => {
        const fresh = await tx.appointment.findUnique({
          where: { id: current.id },
        });
        if (!fresh || !canReschedule(fresh.status as AppointmentStatus)) {
          throw new BadRequestException('Este turno no se puede reprogramar');
        }
        const clash = await findActiveOverlap(tx, {
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
        await writeNote(tx, fresh.id, actor.name, 'Reprogramó el turno');
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
        await writeNote(
          tx,
          next.id,
          actor.name,
          'Creó el turno reprogramado',
        );
        const filled = await this.cola.promoteFirst(tx, fresh, actor);
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
    await this.cola.notifyPromoted(promoted);
    return promoted ? { ...created, promoted } : created;
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

  private parseRange(startIso: string, endIso: string): Range {
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
