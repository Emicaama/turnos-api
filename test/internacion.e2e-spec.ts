import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { SeedService, SEED_ACCOUNTS } from '../src/seed/seed.service';
import { setupApp } from '../src/setup-app';

type Row = {
  id: string;
  number?: string;
  status?: string;
  patientId?: string;
  protocolTasks?: string[];
  price?: number;
  payer?: string;
  amount?: number;
  total?: number;
  stockRestante?: number;
  accountLine?: { concept: string };
  appointment?: { id: string };
};

describe('Internación, stock y facturación (e2e)', () => {
  let app: INestApplication<App>;
  let professionalId: string;
  let branchId: string;
  const tokens: Record<'secretaria' | 'enfermero' | 'medico', string> = {
    secretaria: '',
    enfermero: '',
    medico: '',
  };

  async function login(account: { email: string; password: string }) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(account)
      .expect(201);
    return (res.body as { accessToken: string }).accessToken;
  }

  function as(role: keyof typeof tokens) {
    const server = app.getHttpServer();
    const auth = { Authorization: `Bearer ${tokens[role]}` };
    return {
      get: (url: string) => request(server).get(url).set(auth),
      post: (url: string, body: object = {}) =>
        request(server).post(url).set(auth).send(body),
      patch: (url: string, body: object) =>
        request(server).patch(url).set(auth).send(body),
    };
  }

  async function bookFor(patientId: string, startAt: string, endAt: string) {
    const res = await as('secretaria')
      .post('/api/v1/appointments', {
        patientId,
        professionalId,
        branchId,
        startAt,
        endAt,
      })
      .expect(201);
    return (res.body as Row).appointment?.id ?? '';
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    const seed = app.get(SeedService);
    await seed.reset();
    const seeded = await seed.run();
    professionalId = seeded.professionalId;
    branchId = seeded.branchId;

    tokens.secretaria = await login(SEED_ACCOUNTS.secretaria);
    tokens.enfermero = await login(SEED_ACCOUNTS.enfermero);
    tokens.medico = await login(SEED_ACCOUNTS.medicos.ana);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('factura una consulta seg?n la cobertura prepaga', async () => {
    const patients = (await as('secretaria').get('/api/v1/patients'))
      .body as Row[];
    const patientId = patients[0].id;
    await as('secretaria')
      .patch(`/api/v1/patients/${patientId}`, {
        coverage: 'prepaga',
        copay: 3000,
      })
      .expect(200);
    const appointmentId = await bookFor(
      patientId,
      '2026-08-18T12:00:00.000Z',
      '2026-08-18T12:30:00.000Z',
    );

    const charged = await as('secretaria')
      .post(`/api/v1/appointments/${appointmentId}/charges`, { price: 15000 })
      .expect(201);
    expect(
      (charged.body as Row[]).map(({ payer, amount }) => ({ payer, amount })),
    ).toEqual([
      { payer: 'paciente', amount: 3000 },
      { payer: 'prepaga', amount: 12000 },
    ]);

    await as('secretaria')
      .post(`/api/v1/appointments/${appointmentId}/charges`, { price: 15000 })
      .expect(409);
  });

  it('interna, medica, descuenta stock, carga la cuenta y libera la cama', async () => {
    const patients = (await as('secretaria').get('/api/v1/patients'))
      .body as Row[];
    const [first, second] = patients.map((patient) => patient.id);
    const beds = (await as('secretaria').get('/api/v1/beds')).body as Row[];
    const bed = beds.find((item) => item.number === '101') as Row;

    const [a, b] = await Promise.all([
      as('secretaria').post('/api/v1/admissions', {
        patientId: first,
        bedId: bed.id,
        reason: 'cirugia',
      }),
      as('secretaria').post('/api/v1/admissions', {
        patientId: second,
        bedId: bed.id,
        reason: 'respiratorio',
      }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
    const admission = (a.status === 201 ? a.body : b.body) as Row;
    const admittedPatient = admission.patientId as string;
    expect(admission.protocolTasks?.length).toBeGreaterThan(0);

    const supplies = (await as('enfermero').get('/api/v1/supplies'))
      .body as Row[];
    const ibuprofeno = supplies[0];
    const prescription = await as('medico')
      .post(`/api/v1/patients/${admittedPatient}/prescriptions`, {
        supplyId: ibuprofeno.id,
        dosis: '1 comprimido',
        cadaHoras: 8,
      })
      .expect(201);

    const appointmentId = await bookFor(
      admittedPatient,
      '2026-08-18T13:00:00.000Z',
      '2026-08-18T13:30:00.000Z',
    );
    const dose = await as('enfermero')
      .post(`/api/v1/appointments/${appointmentId}/doses`, {
        indicacionId: (prescription.body as Row).id,
        horaIndicada: '2026-08-18T17:00:00.000Z',
        administradaEn: '2026-08-18T17:10:00.000Z',
      })
      .expect(201);
    expect((dose.body as Row).stockRestante).toBe(49);
    expect((dose.body as Row).accountLine?.concept).toBe('Insumos de Farmacia');

    const account = await as('secretaria')
      .get(`/api/v1/admissions/${admission.id}/account`)
      .expect(200);
    expect((account.body as Row).total).toBe(ibuprofeno.price);

    await as('secretaria')
      .post(`/api/v1/admissions/${admission.id}/discharge`)
      .expect(201);
    const inCleaning = (await as('secretaria').get('/api/v1/beds'))
      .body as Row[];
    expect(inCleaning.find((item) => item.id === bed.id)?.status).toBe(
      'en_limpieza',
    );

    await as('secretaria')
      .post('/api/v1/admissions', {
        patientId: admittedPatient,
        bedId: bed.id,
        reason: 'cirugia',
      })
      .expect(409);

    const cleaned = await as('enfermero')
      .patch(`/api/v1/beds/${bed.id}/status`, { status: 'libre' })
      .expect(200);
    expect((cleaned.body as Row).status).toBe('libre');
  });

  it('la secretaría ya no carga dosis', async () => {
    await as('secretaria')
      .post('/api/v1/appointments/00000000-0000-0000-0000-000000000000/doses', {
        indicacionId: '00000000-0000-0000-0000-000000000000',
        horaIndicada: '2026-08-18T17:00:00.000Z',
        administradaEn: '2026-08-18T17:00:00.000Z',
      })
      .expect(403);
  });
});
