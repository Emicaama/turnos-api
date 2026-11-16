import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { doseNote, vitalNote } from '../src/nursing/nursing';
import { setupApp } from '../src/setup-app';
import { SEED_ACCOUNTS, resetSeed, runSeed } from '../seed/run';

type Row = {
  id: string;
  name?: string;
  number?: string;
  status?: string;
  patientId?: string;
  protocolTasks?: string[];
  reason?: string | null;
  tasks?: string[];
  appointmentBalance?: number;
  supplyBalance?: number;
  price?: number;
  payer?: string;
  amount?: number;
  total?: number;
  stockRestante?: number;
  accountLine?: { concept: string };
  appointment?: { id: string };
  admissionId?: string;
  fueraDeRango?: boolean;
  kind?: string;
  text?: string;
};

const VITALS = { sistolica: 120, diastolica: 80, frecuenciaCardiaca: 72 };

describe('Internaci�n, stock y facturaci�n (e2e)', () => {
  let app: INestApplication<App>;
  let professionalId: string;
  let branchId: string;
  const tokens: Record<
    'admin' | 'secretaria' | 'enfermero' | 'medico',
    string
  > = {
    admin: '',
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

  async function balancesOf(patientId: string) {
    const res = await as('secretaria')
      .get(`/api/v1/patients/${patientId}`)
      .expect(200);
    const { appointmentBalance, supplyBalance } = res.body as Row;
    return { appointmentBalance, supplyBalance };
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    await resetSeed();
    const seeded = await runSeed(true);
    professionalId = seeded.professionalId;
    branchId = seeded.branchId;

    tokens.admin = await login(SEED_ACCOUNTS.admin);
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
    const before = await balancesOf(patientId);

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
    expect(await balancesOf(patientId)).toEqual({
      appointmentBalance: (before.appointmentBalance as number) + 3000,
      supplyBalance: before.supplyBalance,
    });
    await as('secretaria')
      .patch(`/api/v1/patients/${patientId}`, { appointmentBalance: 0 })
      .expect(400);
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
    const before = await balancesOf(admittedPatient);

    const dose = await as('enfermero')
      .post(`/api/v1/admissions/${admission.id}/doses`, {
        indicacionId: (prescription.body as Row).id,
        horaIndicada: '2026-08-18T17:00:00.000Z',
        administradaEn: '2026-08-18T17:10:00.000Z',
      })
      .expect(201);
    expect((dose.body as Row).stockRestante).toBe(49);
    expect((dose.body as Row).accountLine?.concept).toBe('Insumos de Farmacia');
    expect(await balancesOf(admittedPatient)).toEqual({
      appointmentBalance: before.appointmentBalance,
      supplyBalance:
        (before.supplyBalance as number) + (ibuprofeno.price as number),
    });

    const stable = await as('enfermero')
      .post(`/api/v1/admissions/${admission.id}/vitals`, {
        ...VITALS,
        temperatura: 39,
      })
      .expect(201);
    expect(stable.body as Row).toMatchObject({
      admissionId: admission.id,
      patientId: admittedPatient,
      fueraDeRango: false,
    });
    const fever = await as('enfermero')
      .post(`/api/v1/admissions/${admission.id}/vitals`, {
        ...VITALS,
        temperatura: 39.5,
      })
      .expect(201);
    expect((fever.body as Row).fueraDeRango).toBe(true);

    const notes = await as('medico')
      .get(`/api/v1/binnacle/admissions/${admission.id}`)
      .expect(200);
    const entries = (notes.body as Row[]).map(({ kind, text }) => ({
      kind,
      text,
    }));
    expect(entries).toHaveLength(3);
    expect(entries).toEqual(
      expect.arrayContaining([
        {
          kind: 'medicacion',
          text: doseNote(ibuprofeno.name as string, '1 comprimido'),
        },
        { kind: 'signos', text: vitalNote(false) },
        { kind: 'signos', text: vitalNote(true) },
      ]),
    );

    const account = await as('secretaria')
      .get(`/api/v1/admissions/${admission.id}/account`)
      .expect(200);
    expect((account.body as Row).total).toBe(ibuprofeno.price);

    await as('secretaria')
      .post(`/api/v1/admissions/${admission.id}/discharge`)
      .expect(201);
    await as('enfermero')
      .post(`/api/v1/admissions/${admission.id}/vitals`, {
        ...VITALS,
        temperatura: 36.5,
      })
      .expect(400);
    await as('enfermero')
      .post(`/api/v1/admissions/${admission.id}/doses`, {
        indicacionId: (prescription.body as Row).id,
        horaIndicada: '2026-08-18T17:00:00.000Z',
        administradaEn: '2026-08-18T17:00:00.000Z',
      })
      .expect(400);
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
      .patch(`/api/v1/beds/${bed.id}/status`, { status: 'disponible' })
      .expect(200);
    expect((cleaned.body as Row).status).toBe('disponible');
  });

  it('la secretar�a ya no carga dosis ni signos', async () => {
    const missing = '00000000-0000-0000-0000-000000000000';
    await as('secretaria')
      .post(`/api/v1/admissions/${missing}/doses`, {
        indicacionId: missing,
        horaIndicada: '2026-08-18T17:00:00.000Z',
        administradaEn: '2026-08-18T17:00:00.000Z',
      })
      .expect(403);
    await as('secretaria')
      .post(`/api/v1/admissions/${missing}/vitals`, {
        ...VITALS,
        temperatura: 36.5,
      })
      .expect(403);
  });

  it('interna sin motivo o sin protocolo y usa los protocolos creados', async () => {
    const active = (await as('secretaria').get('/api/v1/admissions'))
      .body as Row[];
    const busy = new Set(active.map((admission) => admission.patientId));
    const free = (
      (await as('secretaria').get('/api/v1/patients')).body as Row[]
    )
      .filter((patient) => !busy.has(patient.id))
      .map((patient) => patient.id);
    const wing = (
      await as('admin')
        .post('/api/v1/wings', {
          name: 'Ala 4',
          code: 4,
          description: 'Pruebas',
        })
        .expect(201)
    ).body as Row;
    const newBed = async () =>
      (
        (
          await as('admin')
            .post('/api/v1/beds', { wingId: wing.id })
            .expect(201)
        ).body as Row
      ).id;

    const withoutReason = await as('secretaria')
      .post('/api/v1/admissions', {
        patientId: free[0],
        bedId: await newBed(),
      })
      .expect(201);
    expect(withoutReason.body as Row).toMatchObject({
      reason: null,
      protocolTasks: [],
    });

    const unknown = await as('secretaria')
      .post('/api/v1/admissions', {
        patientId: free[1],
        bedId: await newBed(),
        reason: 'Traumatismo',
      })
      .expect(201);
    expect(unknown.body as Row).toMatchObject({
      reason: 'traumatismo',
      protocolTasks: [],
    });

    const tasks = ['Inmovilizar el miembro', 'Control del dolor cada 4 horas'];
    await as('secretaria')
      .post('/api/v1/protocols', { reason: 'traumatismo', tasks })
      .expect(403);
    const created = await as('medico')
      .post('/api/v1/protocols', { reason: ' Traumatismo ', tasks })
      .expect(201);
    expect(created.body as Row).toMatchObject({ reason: 'traumatismo', tasks });
    await as('admin')
      .post('/api/v1/protocols', { reason: 'TRAUMATISMO', tasks })
      .expect(409);
    await as('admin')
      .post('/api/v1/protocols', { reason: 'vacio', tasks: [] })
      .expect(400);

    const withProtocol = await as('secretaria')
      .post('/api/v1/admissions', {
        patientId: free[2],
        bedId: await newBed(),
        reason: 'traumatismo',
      })
      .expect(201);
    expect((withProtocol.body as Row).protocolTasks).toEqual(tasks);

    const protocols = (
      await as('enfermero').get('/api/v1/protocols').expect(200)
    ).body as Row[];
    expect(protocols.map((protocol) => protocol.reason)).toEqual([
      'cirugia',
      'pediatria',
      'respiratorio',
      'traumatismo',
    ]);
  });

  it('no carga signos sin una internaci�n', async () => {
    await as('enfermero')
      .post('/api/v1/admissions/00000000-0000-0000-0000-000000000000/vitals', {
        ...VITALS,
        temperatura: 36.5,
      })
      .expect(404);
  });
});
