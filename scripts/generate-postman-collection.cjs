/**
 * Genera la colección Postman de presentación (historias A–D).
 * Uso: node scripts/generate-postman-collection.cjs
 */
const fs = require('fs');
const path = require('path');

const bearer = {
  type: 'bearer',
  bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }],
};

function url(rawPath, query) {
  const parts = rawPath.replace(/^\//, '').split('/').filter(Boolean);
  const u = {
    raw:
      '{{baseUrl}}/' +
      parts.join('/') +
      (query && query.length
        ? '?' + query.map((q) => q.key + '=' + (q.value || '')).join('&')
        : ''),
    host: ['{{baseUrl}}'],
    path: parts,
  };
  if (query) u.query = query;
  return u;
}

function req(name, method, p, opts = {}) {
  const r = {
    name,
    request: {
      method,
      header: opts.body
        ? [{ key: 'Content-Type', value: 'application/json' }]
        : [],
      url: url(p, opts.query),
      description: opts.description || '',
    },
  };
  if (opts.auth === false) r.request.auth = { type: 'noauth' };
  if (opts.body) {
    r.request.body = {
      mode: 'raw',
      raw:
        typeof opts.body === 'string'
          ? opts.body
          : JSON.stringify(opts.body, null, 2),
      options: { raw: { language: 'json' } },
    };
  }
  if (opts.tests) {
    r.event = [
      {
        listen: 'test',
        script: { type: 'text/javascript', exec: opts.tests },
      },
    ];
  }
  return r;
}

const saveToken = [
  'const body = pm.response.json();',
  "if (body && body.accessToken) pm.collectionVariables.set('accessToken', body.accessToken);",
  "pm.test('Login OK', () => pm.response.to.have.status(201));",
];

function saveFirst(key, pickExpr) {
  return [
    'if (pm.response.code >= 200 && pm.response.code < 300) {',
    '  const body = pm.response.json();',
    `  const id = ${pickExpr};`,
    `  if (id) pm.collectionVariables.set('${key}', id);`,
    '}',
  ];
}

const collection = {
  info: {
    name: 'Turnos API — Historias A–D (Presentación)',
    description: [
      '# Turnos API — Demo por historias de usuario',
      '',
      'Colección para presentar el backend del hospital (Metodología).',
      '',
      '## Cómo usar',
      '1. Postman → **Import** → subí este JSON (y el environment si querés).',
      '2. API Docker: `http://localhost:3001/api/v1` (variable `baseUrl`).',
      '3. Corré **00 Setup → Login secretaría** (guarda el JWT).',
      '4. Corré **00 Setup → Cargar IDs del seed**.',
      '5. Presentá en orden las carpetas **A → D**.',
      '',
      '## Cuentas seed',
      '- `secretaria@turnos.local` / `Secretaria123!`',
      '- `admin@turnos.local` / `Admin123!`',
      '- `ana.perez@turnos.local` / `Medico123!`',
      '- `enfermero@turnos.local` / `Enfermero123!`',
      '',
      '## Mapa de historias',
      '- **A1** reserva · **A2** entreturno · **A3** lista de espera · **A4** estados · **A5** triaje',
      '- **B1** signos · **B2** medicación · **B3** protocolos',
      '- **C1** cama · **C2** limpieza/alta · **C3** stock',
      '- **D1** cargo consulta · **D2** cuenta insumos',
    ].join('\n'),
    schema:
      'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: bearer,
  variable: [
    { key: 'baseUrl', value: 'http://localhost:3001/api/v1' },
    { key: 'accessToken', value: '' },
    { key: 'branchId', value: '' },
    { key: 'specialtyId', value: '' },
    { key: 'professionalId', value: '' },
    { key: 'patientId', value: '' },
    { key: 'patientId2', value: '' },
    { key: 'userId', value: '' },
    { key: 'appointmentId', value: '' },
    { key: 'waitlistId', value: '' },
    { key: 'bedId', value: '' },
    { key: 'bedDisponibleId', value: '' },
    { key: 'wingId', value: '' },
    { key: 'admissionId', value: '' },
    { key: 'supplyId', value: '' },
    { key: 'prescriptionId', value: '' },
    { key: 'availabilityId', value: '' },
    { key: 'day', value: '' },
    { key: 'slotStart', value: '' },
    { key: 'slotEnd', value: '' },
  ],
  item: [],
};

collection.item.push({
  name: '00 Setup (auth + IDs seed)',
  description:
    'Arranque de la demo. Login guarda JWT. "Cargar IDs" toma recursos del seed para no copiar UUIDs a mano.',
  item: [
    req('Health', 'GET', 'health', {
      auth: false,
      description: 'Ping público + Postgres.',
      tests: ["pm.test('OK', () => pm.response.to.have.status(200));"],
    }),
    req('Login secretaría', 'POST', 'auth/login', {
      auth: false,
      body: {
        email: 'secretaria@turnos.local',
        password: 'Secretaria123!',
      },
      description: 'Reserva turnos, sala, cancela, factura e interna.',
      tests: saveToken,
    }),
    req('Login admin', 'POST', 'auth/login', {
      auth: false,
      body: { email: 'admin@turnos.local', password: 'Admin123!' },
      description: 'Catálogo + permisos amplios.',
      tests: saveToken,
    }),
    req('Login médico', 'POST', 'auth/login', {
      auth: false,
      body: { email: 'ana.perez@turnos.local', password: 'Medico123!' },
      description: 'Marca atendido e indica medicación.',
      tests: saveToken,
    }),
    req('Login enfermero', 'POST', 'auth/login', {
      auth: false,
      body: {
        email: 'enfermero@turnos.local',
        password: 'Enfermero123!',
      },
      description: 'Signos, dosis, triaje y alta.',
      tests: saveToken,
    }),
    req('Quién soy', 'GET', 'users/me', {
      description: 'Payload del JWT actual.',
    }),
    req('Cargar IDs del seed', 'GET', 'branches', {
      description:
        'Encadena listados y guarda branchId, professionalId, patientId(s), camas, insumos, admission y un slot libre (próximo lunes 16:00 ART).',
      tests: [
        'const base = pm.collectionVariables.get("baseUrl");',
        'const token = pm.collectionVariables.get("accessToken");',
        'const h = { Authorization: "Bearer " + token, Accept: "application/json" };',
        'const getJson = (p) => new Promise((resolve, reject) => {',
        '  pm.sendRequest({ url: base + "/" + p, method: "GET", header: h }, (err, res) => {',
        '    if (err) return reject(err);',
        '    try { resolve(res.json()); } catch (e) { reject(e); }',
        '  });',
        '});',
        '(async () => {',
        '  const branches = await getJson("branches");',
        '  const central = (branches || []).find((b) => (b.name || "").toLowerCase().includes("central")) || (branches || [])[0];',
        '  if (central) pm.collectionVariables.set("branchId", central.id);',
        '  const specs = await getJson("specialties");',
        '  if (specs[0]) pm.collectionVariables.set("specialtyId", specs[0].id);',
        '  const pros = await getJson("professionals");',
        '  if (pros[0]) pm.collectionVariables.set("professionalId", pros[0].id);',
        '  const pats = await getJson("patients");',
        '  if (pats[0]) pm.collectionVariables.set("patientId", pats[0].id);',
        '  if (pats[1]) pm.collectionVariables.set("patientId2", pats[1].id);',
        '  const beds = await getJson("beds");',
        '  const libre = (beds || []).find((b) => b.status === "disponible");',
        '  if (libre) pm.collectionVariables.set("bedDisponibleId", libre.id);',
        '  if (beds[0]) pm.collectionVariables.set("bedId", beds[0].id);',
        '  const wings = await getJson("wings");',
        '  if (wings[0]) pm.collectionVariables.set("wingId", wings[0].id);',
        '  const supplies = await getJson("supplies");',
        '  if (supplies[0]) pm.collectionVariables.set("supplyId", supplies[0].id);',
        '  const adm = await getJson("admissions");',
        '  if (adm[0]) pm.collectionVariables.set("admissionId", adm[0].id);',
        '  const apps = await getJson("appointments");',
        '  const prog = (apps || []).find((a) => a.status === "programado") || (apps || [])[0];',
        '  if (prog) pm.collectionVariables.set("appointmentId", prog.id);',
        '  const pid = pm.collectionVariables.get("professionalId");',
        '  const av = await getJson("availability?professionalId=" + pid);',
        '  if (av[0]) pm.collectionVariables.set("availabilityId", av[0].id);',
        '  const now = new Date();',
        '  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));',
        '  const day = d.getUTCDay();',
        '  const add = day === 0 ? 1 : day === 6 ? 2 : (8 - day) % 7 || 7;',
        '  d.setUTCDate(d.getUTCDate() + add);',
        '  const y = d.getUTCFullYear();',
        '  const m = String(d.getUTCMonth() + 1).padStart(2, "0");',
        '  const dd = String(d.getUTCDate()).padStart(2, "0");',
        '  pm.collectionVariables.set("day", y + "-" + m + "-" + dd);',
        '  pm.collectionVariables.set("slotStart", y + "-" + m + "-" + dd + "T19:00:00.000Z");',
        '  pm.collectionVariables.set("slotEnd", y + "-" + m + "-" + dd + "T19:30:00.000Z");',
        '  console.log("IDs cargados", {',
        '    branchId: pm.collectionVariables.get("branchId"),',
        '    professionalId: pm.collectionVariables.get("professionalId"),',
        '    patientId: pm.collectionVariables.get("patientId"),',
        '    day: pm.collectionVariables.get("day"),',
        '  });',
        '  pm.test("IDs cargados", () => pm.expect(pm.collectionVariables.get("branchId")).to.be.ok);',
        '})().catch((e) => { console.error(e); throw e; });',
      ],
    }),
  ],
});

collection.item.push({
  name: '01 Catálogo (F2)',
  description:
    'Sedes, especialidades, profesionales, disponibilidad, pacientes, usuarios, alas y camas.',
  item: [
    {
      name: 'Sucursales',
      item: [
        req('Listar sucursales', 'GET', 'branches', {
          tests: saveFirst('branchId', 'Array.isArray(body) && body[0] && body[0].id'),
        }),
        req('Ver sucursal', 'GET', 'branches/{{branchId}}'),
        req('Crear sucursal', 'POST', 'branches', {
          body: { name: 'Sucursal Demo', address: 'Calle Demo 100' },
        }),
        req('Actualizar sucursal', 'PATCH', 'branches/{{branchId}}', {
          body: { address: 'Calle Demo 200' },
        }),
      ],
    },
    {
      name: 'Especialidades',
      item: [
        req('Listar especialidades', 'GET', 'specialties', {
          tests: saveFirst(
            'specialtyId',
            'Array.isArray(body) && body[0] && body[0].id',
          ),
        }),
        req('Ver especialidad', 'GET', 'specialties/{{specialtyId}}'),
        req('Crear especialidad', 'POST', 'specialties', {
          body: {
            name: 'Dermatología Demo',
            description: 'Demo',
            icon: 'bi-droplet',
            active: true,
          },
        }),
        req('Actualizar especialidad', 'PATCH', 'specialties/{{specialtyId}}', {
          body: { description: 'Actualizada' },
        }),
        req('Eliminar especialidad', 'DELETE', 'specialties/{{specialtyId}}', {
          description: 'Solo si no tiene médicos asociados.',
        }),
      ],
    },
    {
      name: 'Profesionales',
      item: [
        req('Listar profesionales', 'GET', 'professionals', {
          tests: saveFirst(
            'professionalId',
            'Array.isArray(body) && body[0] && body[0].id',
          ),
        }),
        req('Ver profesional', 'GET', 'professionals/{{professionalId}}'),
        req('Crear profesional', 'POST', 'professionals', {
          body: {
            firstName: 'Demo',
            lastName: 'Médico',
            specialtyIds: ['{{specialtyId}}'],
            branchIds: ['{{branchId}}'],
            licenseNumber: 'MN-DEMO',
            status: 'activo',
          },
        }),
        req('Actualizar profesional', 'PATCH', 'professionals/{{professionalId}}', {
          body: { office: 'Consultorio 9' },
        }),
        req('Agenda del profesional', 'GET', 'professionals/{{professionalId}}/agenda', {
          query: [
            { key: 'from', value: '{{slotStart}}' },
            { key: 'to', value: '{{slotEnd}}' },
          ],
        }),
      ],
    },
    {
      name: 'Disponibilidad',
      item: [
        req('Listar franjas', 'GET', 'availability', {
          query: [{ key: 'professionalId', value: '{{professionalId}}' }],
          tests: saveFirst(
            'availabilityId',
            'Array.isArray(body) && body[0] && body[0].id',
          ),
        }),
        req('Crear franja', 'POST', 'availability', {
          body: {
            professionalId: '{{professionalId}}',
            branchId: '{{branchId}}',
            weekday: 1,
            startTime: '09:00',
            endTime: '13:00',
            slotMinutes: 30,
            modality: 'presencial',
            status: 'activo',
          },
        }),
        req('Actualizar franja', 'PATCH', 'availability/{{availabilityId}}', {
          body: { endTime: '13:30' },
        }),
      ],
    },
    {
      name: 'Pacientes',
      item: [
        req('Listar pacientes', 'GET', 'patients', {
          tests: [
            'if (pm.response.code === 200) {',
            '  const body = pm.response.json();',
            '  if (body[0]) pm.collectionVariables.set("patientId", body[0].id);',
            '  if (body[1]) pm.collectionVariables.set("patientId2", body[1].id);',
            '}',
          ],
        }),
        req('Ver paciente', 'GET', 'patients/{{patientId}}'),
        req('Crear paciente', 'POST', 'patients', {
          body: {
            firstName: 'Presentacion',
            lastName: 'Demo',
            documentId: '45999888',
            coverage: 'particular',
            phone: '1100000000',
          },
          tests: saveFirst('patientId', 'body && body.id'),
        }),
        req('Actualizar paciente', 'PATCH', 'patients/{{patientId}}', {
          body: { phone: '1199999999' },
        }),
      ],
    },
    {
      name: 'Usuarios',
      item: [
        req('Listar usuarios', 'GET', 'users', {
          tests: saveFirst('userId', 'Array.isArray(body) && body[0] && body[0].id'),
        }),
        req('Crear usuario', 'POST', 'users', {
          body: {
            email: 'demo.user@turnos.local',
            password: 'Demo1234!',
            name: 'Usuario Demo',
            role: 'secretaria',
          },
        }),
        req('Actualizar usuario', 'PATCH', 'users/{{userId}}', {
          body: { active: true },
        }),
      ],
    },
    {
      name: 'Alas y camas',
      item: [
        req('Listar alas', 'GET', 'wings', {
          tests: saveFirst('wingId', 'Array.isArray(body) && body[0] && body[0].id'),
        }),
        req('Crear ala', 'POST', 'wings', {
          body: { name: 'Ala Demo', code: 9, description: 'Demo presentación' },
        }),
        req('Listar camas', 'GET', 'beds', {
          tests: [
            'if (pm.response.code === 200) {',
            '  const body = pm.response.json();',
            '  const libre = (body || []).find((b) => b.status === "disponible");',
            '  if (libre) pm.collectionVariables.set("bedDisponibleId", libre.id);',
            '  if (body[0]) pm.collectionVariables.set("bedId", body[0].id);',
            '}',
          ],
        }),
        req('Crear cama', 'POST', 'beds', {
          body: { wingId: '{{wingId}}', sala: 'Demo' },
          tests: saveFirst('bedDisponibleId', 'body && body.id'),
        }),
      ],
    },
  ],
});

collection.item.push({
  name: 'A — Admisión',
  description:
    'Historias A1–A5: reserva, entreturno, lista de espera, estados y triaje.',
  item: [
    {
      name: 'A1 — Reserva de turno seguro',
      description:
        'POST /appointments sin entreturno. Libre → programado. Carrera serializable → 409.',
      item: [
        req('A1 Reservar turno (programado)', 'POST', 'appointments', {
          description:
            'Usá slotStart/slotEnd del Setup (próximo lunes 16:00 ART = 19:00Z). Login secretaría/admin.',
          body: {
            patientId: '{{patientId}}',
            professionalId: '{{professionalId}}',
            branchId: '{{branchId}}',
            startAt: '{{slotStart}}',
            endAt: '{{slotEnd}}',
            notes: 'Demo A1 presentación',
          },
          tests: [
            'const body = pm.response.json();',
            'pm.test("Programado o waitlist", () => {',
            '  pm.expect(["programado", "lista_de_espera"]).to.include(body.result);',
            '});',
            'if (body.result === "programado" && body.appointment) {',
            '  pm.collectionVariables.set("appointmentId", body.appointment.id);',
            '} else if (body.waitlist) {',
            '  pm.collectionVariables.set("waitlistId", body.waitlist.id);',
            '}',
          ],
        }),
        req('Listar turnos', 'GET', 'appointments', {
          query: [
            { key: 'professionalId', value: '{{professionalId}}' },
            { key: 'from', value: '{{slotStart}}' },
            { key: 'to', value: '{{slotEnd}}' },
          ],
        }),
        req('Ver turno', 'GET', 'appointments/{{appointmentId}}'),
        req('Bitácora del turno', 'GET', 'binnacle/{{appointmentId}}'),
      ],
    },
    {
      name: 'A2 — Entreturno',
      description:
        'entreturno:true. Inicio :15 o :45 en CLINIC_TZ. Acorta el turno en curso.',
      item: [
        req('A2 Insertar entreturno', 'POST', 'appointments', {
          description:
            'Requiere turno activo que cubra el instante. Ej: 16:00–16:30 y entreturno 16:15–16:30 (19:15–19:30Z).',
          body: {
            patientId: '{{patientId2}}',
            professionalId: '{{professionalId}}',
            branchId: '{{branchId}}',
            startAt: '{{day}}T19:15:00.000Z',
            endAt: '{{day}}T19:30:00.000Z',
            entreturno: true,
            notes: 'Demo A2 entreturno',
          },
          tests: [
            'const body = pm.response.json();',
            'if (body.appointment) pm.collectionVariables.set("appointmentId", body.appointment.id);',
          ],
        }),
      ],
    },
    {
      name: 'A3 — Lista de espera',
      description:
        'Hueco ocupado → encola. Cancelar → promueve. GET /appointments/waitlist.',
      item: [
        req('A3 Intentar mismo horario (→ waitlist)', 'POST', 'appointments', {
          description:
            'Mismo slotStart/slotEnd de A1 con otro paciente → result lista_de_espera.',
          body: {
            patientId: '{{patientId2}}',
            professionalId: '{{professionalId}}',
            branchId: '{{branchId}}',
            startAt: '{{slotStart}}',
            endAt: '{{slotEnd}}',
            notes: 'Demo A3 waitlist',
          },
          tests: [
            'const body = pm.response.json();',
            'if (body.waitlist) pm.collectionVariables.set("waitlistId", body.waitlist.id);',
            'pm.test("Respondió result", () => pm.expect(body.result).to.be.ok);',
          ],
        }),
        req('A3 Listar lista de espera', 'GET', 'appointments/waitlist', {
          query: [
            { key: 'day', value: '{{day}}' },
            { key: 'professionalId', value: '{{professionalId}}' },
            { key: 'branchId', value: '{{branchId}}' },
          ],
          description: 'Solo pendientes (sin promotedAppointmentId).',
        }),
        req('A3 Cancelar hueco (promueve waitlist)', 'POST', 'appointments/{{appointmentId}}/cancel', {
          description:
            'Cancela el ocupado; el primero de la cola queda programado.',
        }),
      ],
    },
    {
      name: 'A4 — Estados de atención',
      description:
        'programado → en_sala_de_espera → atendido. cancelado desde los dos primeros.',
      item: [
        req('A4 Pasar a sala de espera', 'PATCH', 'appointments/{{appointmentId}}', {
          body: { status: 'en_sala_de_espera' },
          description: 'Secretaría/admin. Log: avisar al consultorio.',
        }),
        req('A4 Marcar atendido', 'PATCH', 'appointments/{{appointmentId}}', {
          body: { status: 'atendido' },
          description: 'Médico/admin. Solo desde en_sala_de_espera.',
        }),
        req('A4 Cancelar turno', 'POST', 'appointments/{{appointmentId}}/cancel', {
          description: 'Desde programado o en_sala. Puede promover waitlist.',
        }),
      ],
    },
    {
      name: 'A5 — Triaje de guardia',
      description:
        'Clasifica sin crear turno. Orden: rojo → amarillo → verde; a igual nivel, llegada.',
      item: [
        req('A5 Clasificar rojo', 'POST', 'triage', {
          body: {
            patientId: '{{patientId}}',
            branchId: '{{branchId}}',
            level: 'rojo',
          },
          description: 'Riesgo vital → log [guardia].',
        }),
        req('A5 Clasificar amarillo', 'POST', 'triage', {
          body: {
            patientId: '{{patientId2}}',
            branchId: '{{branchId}}',
            level: 'amarillo',
          },
        }),
        req('A5 Clasificar verde', 'POST', 'triage', {
          body: {
            patientId: '{{patientId}}',
            branchId: '{{branchId}}',
            level: 'verde',
          },
        }),
        req('A5 Cola de triaje', 'GET', 'triage', {
          query: [{ key: 'branchId', value: '{{branchId}}' }],
        }),
      ],
    },
  ],
});

collection.item.push({
  name: 'B — Atención',
  description: 'B1 signos · B2 indicación + dosis · B3 protocolos.',
  item: [
    {
      name: 'B1 — Signos vitales',
      description:
        'Sobre internación activa. >39 °C → fueraDeRango + log guardia.',
      item: [
        req('Listar internaciones activas', 'GET', 'admissions', {
          tests: saveFirst(
            'admissionId',
            'Array.isArray(body) && body[0] && body[0].id',
          ),
        }),
        req('Internación por paciente', 'GET', 'admissions/by-patient/{{patientId}}'),
        req('B1 Signos en rango', 'POST', 'admissions/{{admissionId}}/vitals', {
          body: {
            sistolica: 120,
            diastolica: 80,
            frecuenciaCardiaca: 72,
            temperatura: 36.8,
            notes: 'Control OK',
          },
        }),
        req('B1 Signos con fiebre', 'POST', 'admissions/{{admissionId}}/vitals', {
          body: {
            sistolica: 130,
            diastolica: 85,
            frecuenciaCardiaca: 98,
            temperatura: 39.4,
            notes: 'Fiebre',
          },
          description: 'temperatura > 39 → fueraDeRango true.',
        }),
        req('Listar signos de la internación', 'GET', 'admissions/{{admissionId}}/vitals'),
        req('Listar signos del paciente', 'GET', 'patients/{{patientId}}/vitals'),
        req('Bitácora de la internación', 'GET', 'binnacle/admissions/{{admissionId}}'),
      ],
    },
    {
      name: 'B2 — Medicación prescrita',
      description:
        'Médico indica. Enfermero administra (±30 min). Dispara C3 y D2.',
      item: [
        req('B2 Crear indicación', 'POST', 'patients/{{patientId}}/prescriptions', {
          description:
            'Login médico/admin. Body: supplyId, dosis, cadaHoras.',
          body: {
            supplyId: '{{supplyId}}',
            dosis: '1 comprimido',
            cadaHoras: 8,
          },
          tests: saveFirst('prescriptionId', 'body && body.id'),
        }),
        req('Listar indicaciones del paciente', 'GET', 'patients/{{patientId}}/prescriptions', {
          tests: saveFirst(
            'prescriptionId',
            'Array.isArray(body) && body[0] && body[0].id',
          ),
        }),
        req('B2 Administrar dosis', 'POST', 'admissions/{{admissionId}}/doses', {
          description:
            'Login enfermero. Descuenta stock (C3) y agrega línea a la cuenta (D2). horaIndicada debe estar a ±30 min de ahora.',
          body: {
            prescriptionId: '{{prescriptionId}}',
            horaIndicada: '{{$isoTimestamp}}',
          },
        }),
      ],
    },
    {
      name: 'B3 — Protocolos',
      description:
        'Al internar con reason se copian protocolTasks. POST /protocols crea motivos.',
      item: [
        req('Listar protocolos', 'GET', 'protocols'),
        req('B3 Crear protocolo', 'POST', 'protocols', {
          body: {
            reason: 'demo-presentacion',
            tasks: [
              'Control de signos cada 4 h',
              'Hidratación oral',
              'Aviso a médico de guardia',
            ],
          },
          description: 'Roles: admin o profesional.',
        }),
      ],
    },
  ],
});

collection.item.push({
  name: 'C — Camas y stock',
  description: 'C1 ocupar · C2 limpieza/bloqueo · C3 stock (vía dosis).',
  item: [
    {
      name: 'C1 — Asignación de cama',
      description:
        'Interna en cama disponible. Concurrencia → 409. Copia protocolo del reason (B3).',
      item: [
        req('C1 Internar paciente', 'POST', 'admissions', {
          body: {
            patientId: '{{patientId2}}',
            bedId: '{{bedDisponibleId}}',
            reason: 'respiratorio',
            diagnosis: 'Demo presentación C1',
            treatingProfessionalId: '{{professionalId}}',
            notes: 'Ingreso demo',
          },
          tests: [
            'const body = pm.response.json();',
            'if (body && body.id) pm.collectionVariables.set("admissionId", body.id);',
            'if (body && body.bedId) pm.collectionVariables.set("bedId", body.bedId);',
          ],
        }),
        req('Listar internaciones', 'GET', 'admissions'),
        req('Ver internación', 'GET', 'admissions/{{admissionId}}'),
      ],
    },
    {
      name: 'C2 — Higiene y mantenimiento',
      description:
        'Alta → cama en_limpieza. PATCH status → disponible o bloqueada.',
      item: [
        req('C2 Dar alta', 'POST', 'admissions/{{admissionId}}/discharge', {
          description: 'Admin, secretaría o enfermero.',
        }),
        req('C2 Confirmar limpieza (disponible)', 'PATCH', 'beds/{{bedId}}/status', {
          body: { status: 'disponible' },
        }),
        req('C2 Bloquear cama', 'PATCH', 'beds/{{bedId}}/status', {
          body: { status: 'bloqueada' },
        }),
        req('Actualizar cama', 'PATCH', 'beds/{{bedId}}', {
          body: { sala: 'UCI Demo', habitacion: '901' },
        }),
      ],
    },
    {
      name: 'C3 — Stock de insumos',
      description:
        'El −1 ocurre al administrar la dosis (B2). Acá se consulta y se repone.',
      item: [
        req('Listar insumos', 'GET', 'supplies', {
          tests: saveFirst(
            'supplyId',
            'Array.isArray(body) && body[0] && body[0].id',
          ),
        }),
        req('Crear insumo', 'POST', 'supplies', {
          body: { name: 'Paracetamol 500 mg Demo', stock: 100, price: 500 },
        }),
        req('Actualizar / reponer stock', 'PATCH', 'supplies/{{supplyId}}', {
          body: { stock: 120, price: 550 },
        }),
      ],
    },
  ],
});

collection.item.push({
  name: 'D — Facturación',
  description:
    'D1 cargo de consulta por cobertura · D2 cuenta de insumos · pago de saldos.',
  item: [
    {
      name: 'D1 — Cargo de consulta',
      description:
        'Reparte el precio entre paciente / Estado / prepaga según coverage.',
      item: [
        req('D1 Facturar consulta', 'POST', 'appointments/{{appointmentId}}/charges', {
          body: { price: 15000 },
          description: 'Si ya estaba facturada → 409.',
        }),
      ],
    },
    {
      name: 'D2 — Cuenta de la estadía',
      description: 'Líneas de insumos ligadas a dosis + pago de saldos.',
      item: [
        req('D2 Ver cuenta de internación', 'GET', 'admissions/{{admissionId}}/account'),
        req('Pagar saldos del paciente', 'POST', 'patients/{{patientId}}/pay', {
          description: 'Pone appointmentBalance y supplyBalance en 0.',
          body: {},
        }),
      ],
    },
  ],
});

const outDir = path.join(__dirname, '..', 'postman');
fs.mkdirSync(outDir, { recursive: true });
const collPath = path.join(
  outDir,
  'Turnos-API-Historias-A-D.postman_collection.json',
);
fs.writeFileSync(collPath, JSON.stringify(collection, null, 2));
fs.writeFileSync(
  path.join(__dirname, '..', 'Turnos-API.postman_collection.json'),
  JSON.stringify(collection, null, 2),
);

const env = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  name: 'Turnos API — Local Docker',
  values: [
    {
      key: 'baseUrl',
      value: 'http://localhost:3001/api/v1',
      type: 'default',
      enabled: true,
    },
    { key: 'accessToken', value: '', type: 'secret', enabled: true },
  ],
  _postman_variable_scope: 'environment',
};
fs.writeFileSync(
  path.join(outDir, 'Turnos-API-Local.postman_environment.json'),
  JSON.stringify(env, null, 2),
);

const readme = `# Postman — Turnos API (Historias A–D)

## Importar

1. Abrí Postman → **Import**.
2. Subí:
   - \`Turnos-API-Historias-A-D.postman_collection.json\`
   - \`Turnos-API-Local.postman_environment.json\` (opcional)
3. Seleccioná el environment **Turnos API — Local Docker**.

También está una copia en la raíz del repo: \`../Turnos-API.postman_collection.json\`.

## Orden sugerido para la presentación

1. **00 Setup** → Login secretaría → Cargar IDs del seed  
2. **A — Admisión** (A1 → A5)  
3. **B — Atención** (B1 → B3)  
4. **C — Camas y stock** (C1 → C3)  
5. **D — Facturación** (D1 → D2)  

## Regenerar

\`\`\`bash
node scripts/generate-postman-collection.cjs
\`\`\`
`;
fs.writeFileSync(path.join(outDir, 'README.md'), readme);

const count = JSON.stringify(collection).match(/"method":/g).length;
console.log('Wrote', collPath);
console.log('Folders:', collection.item.map((i) => i.name).join(' | '));
console.log('Requests:', count);
