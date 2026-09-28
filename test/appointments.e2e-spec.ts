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
};
type BinnacleEntry = { text: string; authorName: string };

describe('Turnos (e2e)', () => {
  let app: INestApplication<App>;
  let professionalId: string;
  let patientId: string;
  let branchId: string;
  let secretariaToken: string;
  let profesionalToken: string;

  const slot = {
    startAt: '2026-08-17T12:00:00.000Z',
    endAt: '2026-08-17T12:30:00.000Z',
  };

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

  it('GET /api/v1/health pinea Postgres', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ status: 'ok', postgres: true });
      });
  });

  it('la secretaría crea un turno pendiente', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${secretariaToken}`)
      .send({
        patientId,
        professionalId,
        branchId,
        ...slot,
      })
      .expect(201);

    const body = res.body as AppointmentBody;
    expect(body.status).toBe('pendiente');
    expect(body.professionalId).toBe(professionalId);
  });

  it('rechaza solapamiento con 409', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${secretariaToken}`)
      .send({
        patientId,
        professionalId,
        branchId,
        startAt: '2026-08-17T12:15:00.000Z',
        endAt: '2026-08-17T12:45:00.000Z',
      })
      .expect(409);
  });

  it('el profesional no crea turnos ajenos', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${profesionalToken}`)
      .send({
        patientId,
        professionalId,
        branchId,
        startAt: '2026-08-17T13:00:00.000Z',
        endAt: '2026-08-17T13:30:00.000Z',
      })
      .expect(403);
  });

  it('cancelar deja una nota en la bitácora', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${secretariaToken}`)
      .send({
        patientId,
        professionalId,
        branchId,
        startAt: '2026-08-17T14:00:00.000Z',
        endAt: '2026-08-17T14:30:00.000Z',
      })
      .expect(201);

    const id = (created.body as AppointmentBody).id;

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
