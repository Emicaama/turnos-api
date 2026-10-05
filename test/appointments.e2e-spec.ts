import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { SeedService, SEED_ACCOUNTS } from '../src/seed/seed.service';
import { setupApp } from '../src/setup-app';

type LoginBody = { accessToken: string };
type AppointmentBody = {
  id: string;
  status: string;
  professionalId: string;
  patientId: string;
  startAt: string;
  endAt: string;
  entreturno: boolean;
  acortado: boolean;
};
type BookingBody = {
  result: 'programado' | 'lista_de_espera';
  appointment?: AppointmentBody;
  acortado?: AppointmentBody;
  waitlist?: { id: string; patientId: string; day: string };
  message?: string;
};
type CancelBody = AppointmentBody & { promoted?: AppointmentBody };
type BinnacleEntry = { text: string; authorName: string };

describe('Turnos (e2e)', () => {
  let app: INestApplication<App>;
  let professionalId: string;
  let patientId: string;
  let branchId: string;
  let secretariaToken: string;
  let profesionalToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    const seed = app.get(SeedService);
    await seed.reset();
    const seeded = await seed.run();
    if (seeded.skipped) {
      throw new Error('El seed no debería saltarse en e2e');
    }
    professionalId = seeded.professionalId;
    patientId = seeded.patientId;
    branchId = seeded.branchId;

    const secretariaLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(SEED_ACCOUNTS.secretaria)
      .expect(201);
    secretariaToken = (secretariaLogin.body as LoginBody).accessToken;

    const profesionalLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(SEED_ACCOUNTS.medicos.ana)
      .expect(201);
    profesionalToken = (profesionalLogin.body as LoginBody).accessToken;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  function book(body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${secretariaToken}`)
      .send({ patientId, professionalId, branchId, ...body });
  }

  it('GET /api/v1/health pinea Postgres', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ status: 'ok', postgres: true });
      });
  });

  it('programa un turno y, si está ocupado, lo deja en espera', async () => {
    const created = await book({
      startAt: '2026-08-17T12:00:00.000Z',
      endAt: '2026-08-17T12:30:00.000Z',
    }).expect(201);
    const booking = created.body as BookingBody;
    expect(booking.result).toBe('programado');
    expect(booking.appointment?.status).toBe('programado');

    const waiting = await book({
      startAt: '2026-08-17T12:00:00.000Z',
      endAt: '2026-08-17T12:30:00.000Z',
    }).expect(201);
    const queued = waiting.body as BookingBody;
    expect(queued.result).toBe('lista_de_espera');
    expect(queued.waitlist?.day).toBe('2026-08-17');
    expect(queued.waitlist?.patientId).toBe(patientId);

    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/appointments/${booking.appointment?.id}/cancel`)
      .set('Authorization', `Bearer ${secretariaToken}`)
      .expect(201);
    const body = cancelled.body as CancelBody;
    expect(body.status).toBe('cancelado');
    expect(body.promoted?.status).toBe('programado');
    expect(body.promoted?.patientId).toBe(patientId);
    expect(body.promoted?.startAt).toBe(booking.appointment?.startAt);
  });

  it('inserta un entreturno a los :15 y acorta el anterior', async () => {
    const created = await book({
      startAt: '2026-08-17T13:00:00.000Z',
      endAt: '2026-08-17T13:30:00.000Z',
    }).expect(201);
    const original = (created.body as BookingBody).appointment;
    expect(original?.id).toBeTruthy();

    const rejected = await book({
      entreturno: true,
      startAt: '2026-08-17T13:00:00.000Z',
      endAt: '2026-08-17T13:15:00.000Z',
    }).expect(400);
    expect(rejected.body.message).toBe(
      'Un entreturno solo puede empezar a los :15 o a los :45',
    );

    const inserted = await book({
      entreturno: true,
      startAt: '2026-08-17T13:15:00.000Z',
      endAt: '2026-08-17T13:30:00.000Z',
    }).expect(201);
    const entre = inserted.body as BookingBody;
    expect(entre.result).toBe('programado');
    expect(entre.appointment?.entreturno).toBe(true);
    expect(entre.appointment?.startAt).toBe('2026-08-17T13:15:00.000Z');
    expect(entre.acortado?.id).toBe(original?.id);
    expect(entre.acortado?.acortado).toBe(true);
    expect(entre.acortado?.endAt).toBe('2026-08-17T13:15:00.000Z');
  });

  it('el profesional no crea turnos ajenos', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${profesionalToken}`)
      .send({
        patientId,
        professionalId,
        branchId,
        startAt: '2026-08-17T15:30:00.000Z',
        endAt: '2026-08-17T16:00:00.000Z',
      })
      .expect(403);
  });

  it('cancelar deja una nota en la bitácora', async () => {
    const created = await book({
      startAt: '2026-08-17T14:00:00.000Z',
      endAt: '2026-08-17T14:30:00.000Z',
    }).expect(201);
    const id = (created.body as BookingBody).appointment?.id;

    await request(app.getHttpServer())
      .post(`/api/v1/appointments/${id}/cancel`)
      .set('Authorization', `Bearer ${secretariaToken}`)
      .expect(201);

    const binnacle = await request(app.getHttpServer())
      .get(`/api/v1/binnacle/${id}`)
      .set('Authorization', `Bearer ${secretariaToken}`)
      .expect(200);

    const entries = binnacle.body as BinnacleEntry[];
    expect(entries.map((entry) => entry.text)).toEqual([
      'Creó el turno',
      'Canceló el turno',
    ]);
  });

  it('pasa por sala de espera y el profesional lo atiende', async () => {
    const created = await book({
      startAt: '2026-08-17T14:30:00.000Z',
      endAt: '2026-08-17T15:00:00.000Z',
    }).expect(201);
    const id = (created.body as BookingBody).appointment?.id;

    const sala = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${id}`)
      .set('Authorization', `Bearer ${secretariaToken}`)
      .send({ status: 'en_sala_de_espera' })
      .expect(200);
    expect((sala.body as AppointmentBody).status).toBe('en_sala_de_espera');

    const attended = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${id}`)
      .set('Authorization', `Bearer ${profesionalToken}`)
      .send({ status: 'atendido' })
      .expect(200);
    expect((attended.body as AppointmentBody).status).toBe('atendido');
  });

  it('un turno cancelado no avanza a atendido', async () => {
    const created = await book({
      startAt: '2026-08-17T15:00:00.000Z',
      endAt: '2026-08-17T15:30:00.000Z',
    }).expect(201);
    const id = (created.body as BookingBody).appointment?.id;

    await request(app.getHttpServer())
      .post(`/api/v1/appointments/${id}/cancel`)
      .set('Authorization', `Bearer ${secretariaToken}`)
      .expect(201);

    const blocked = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${id}`)
      .set('Authorization', `Bearer ${secretariaToken}`)
      .send({ status: 'atendido' })
      .expect(400);
    expect(blocked.body.message).toBe('Un turno cancelado no avanza');
  });

  it('dos reservas simultáneas dejan un solo programado', async () => {
    const payload = {
      patientId,
      professionalId,
      branchId,
      startAt: '2026-08-17T15:30:00.000Z',
      endAt: '2026-08-17T16:00:00.000Z',
    };
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${secretariaToken}`)
        .send(payload),
      request(app.getHttpServer())
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${secretariaToken}`)
        .send(payload),
    ]);

    const responses = [first, second];
    const programmed = responses.filter(
      (res) =>
        res.status === 201 &&
        (res.body as BookingBody).result === 'programado',
    );
    expect(programmed).toHaveLength(1);

    const other = responses.find((res) => res !== programmed[0]);
    if (other?.status === 409) {
      expect(other.body.message).toBe('El turno acaba de ser ocupado');
      return;
    }
    expect(other?.status).toBe(201);
    expect((other?.body as BookingBody).result).toBe('lista_de_espera');
  });

  it('lista la agenda del profesional', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${professionalId}/agenda`)
      .query({
        from: '2026-08-17T00:00:00.000Z',
        to: '2026-08-17T23:59:59.000Z',
      })
      .set('Authorization', `Bearer ${secretariaToken}`)
      .expect(200);

    const agenda = res.body as AppointmentBody[];
    expect(Array.isArray(agenda)).toBe(true);
    expect(agenda.length).toBeGreaterThan(0);
  });
});
