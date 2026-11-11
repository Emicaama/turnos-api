# Uso

## Arranque

```bash
cp .env.example .env
docker compose up -d
npm install
npx prisma db push
npm run seed
npm run start:dev
```

Base: `http://localhost:3000/api/v1`. F1 usa las cuentas del seed: `secretaria@turnos.local` / `Secretaria123!`, `enfermero@turnos.local` / `Enfermero123!`, y los médicos `ana.perez@turnos.local` y `luis.gomez@turnos.local` / `Medico123!`.

Los JSON usan `id` UUID. Header: `Authorization: Bearer <accessToken>`.

## Recorrido de flujos

### F1 — Autenticarse

1. `POST /api/v1/auth/login` con `{ "email", "password" }` (mínimo 8 caracteres en password).
2. Guardar `accessToken`.
3. Resultado esperado: `201` y token Bearer. Credenciales inválidas: `401`.
Entrypoint / evidencia: [`src/auth/auth.controller.ts`](../src/auth/auth.controller.ts)

Comprobar identidad: `GET /api/v1/users/me` → payload `{ id, email, name, role, professionalId? }`.

### F2 — Configurar catálogo clínico

Tras F1 como **admin** (escritura de catálogo) o **secretaría** (pacientes).

1. Sucursal: `POST /api/v1/branches` `{ "name", "address" }` (solo admin).
2. Especialidad: `POST /api/v1/specialties` `{ "name" }` (solo admin).
3. Usuario profesional (opcional): `POST /api/v1/users` con `role: "profesional"`.
4. Profesional: `POST /api/v1/professionals` con `firstName`, `lastName`, `userId?`, `specialtyIds`, `branchIds`.
5. Disponibilidad: `POST /api/v1/availability` `{ professionalId, branchId, weekday (0=domingo … 6=sábado), startTime, endTime, slotMinutes }` (HH:mm).
6. Paciente: `POST /api/v1/patients` `{ firstName, lastName, documentId, email?, phone? }` (admin o secretaría). `documentId` duplicado → `409`.
7. Resultado esperado: `GET` de cada recurso lista el alta. Escritura de sucursal/especialidad/profesional/disponibilidad/usuarios con rol secretaría → `403`.
Entrypoint / evidencia: controllers en `src/branches/`, `src/specialties/`, `src/professionals/`, `src/availability/`, `src/patients/`, `src/users/`

Si el profesional tiene `branchIds` no vacíos, F3 solo admite esas sucursales.

### F3 — Generar y controlar turnos

1. Login secretaría o admin (F1).
2. Obtener `patientId`, `professionalId`, `branchId` (F2).
3. `POST /api/v1/appointments` con `startAt`/`endAt` ISO. El intervalo debe caer en disponibilidad interpretada con `CLINIC_TZ` (example: `America/Argentina/Buenos_Aires`; default de código si falta: `UTC`).
4. Resultado esperado: `201` con `result: "programado"` y `appointment.status: "programado"`. Si ese horario ya tiene un turno activo, el mismo POST responde `201` con `result: "lista_de_espera"`. Si dos reservas entran juntas a un hueco que ambas vieron libre, la segunda es `409`. Fuera de franja o profesional que no atiende esa sucursal → `400`. Login profesional en este POST → `403`.
5. Entreturno: el mismo POST con `entreturno: true`. El inicio, en `CLINIC_TZ`, tiene que ser `:15` o `:45` y el fin tiene que coincidir con el fin del turno que se acorta. Si no, `400`.
6. Listar: `GET /api/v1/appointments` con query opcional `status`, `professionalId`, `branchId`, `from`, `to`. El profesional solo ve los suyos.
7. Anunciar: `PATCH /api/v1/appointments/:id` `{ "status": "en_sala_de_espera" }` (secretaría/admin). El profesional dueño cierra con `{ "status": "atendido" }`.
8. Cancelar: `POST /api/v1/appointments/:id/cancel` (solo admin/secretaría). Si hay lista de espera ese día, la respuesta incluye `promoted`. Reprogramar: `PATCH` con `startAt`/`endAt` (cancela el actual y crea uno nuevo; solo desde `programado`).
Entrypoint / evidencia: [`src/appointments/appointments.controller.ts`](../src/appointments/appointments.controller.ts), [`src/appointments/appointment-rules.ts`](../src/appointments/appointment-rules.ts)

Transiciones: `programado` → `en_sala_de_espera`|`cancelado`; `en_sala_de_espera` → `atendido`|`cancelado`. `atendido` y `cancelado` no avanzan. El profesional no cancela ni reprograma.

Ejemplo de slot lunes 09:00 ART usado en tests de TZ: `2026-08-17T12:00:00.000Z` con `CLINIC_TZ=America/Argentina/Buenos_Aires`.

### F4 — Consultar agenda

1. Tras F1 (y turnos existentes de F3).
2. `GET /api/v1/professionals/:id/agenda?from=<ISO>&to=<ISO>`.
3. Resultado esperado: `200` y turnos no `cancelado` en el rango. Un profesional pidiendo la agenda de otro → `403`.
Entrypoint / evidencia: [`src/appointments/professionals-agenda.controller.ts`](../src/appointments/professionals-agenda.controller.ts)

### F5 — Leer la bitácora de un turno

1. Ejecutar un alta o cancelación (F3).
2. Como admin o secretaría: `GET /api/v1/binnacle/:appointmentId`.
3. Resultado esperado: `200` y notas en orden (`Creó el turno`, `Canceló el turno`, etc.) con `authorName` y `kind: "agenda"`. El profesional que pide la bitácora sin `kind`, o con `kind=agenda`, recibe `403`. Con `kind=signos` o `kind=medicacion` ve solo esas notas de un turno propio.
Entrypoint / evidencia: [`src/binnacle/binnacle.controller.ts`](../src/binnacle/binnacle.controller.ts)

### A5 — Triaje de guardia

1. Login enfermero, secretaría o admin, con un `patientId` y un `branchId` ya creados (F2). El paciente no necesita turno.
2. `POST /api/v1/triage` con `{ patientId, branchId, level }`. `level` es `rojo` (riesgo vital), `amarillo` o `verde`.
3. Resultado esperado: `201` y un `TriageEntry`. No se crea un turno. Si `level` es `rojo`, el log escribe `[guardia]` pidiendo avisar a la guardia. `amarillo` y `verde` entran a la cola y no avisan.
4. `GET /api/v1/triage?branchId=` devuelve `200` y la cola de esa sucursal: primero `rojo`, después `amarillo`, después `verde`. A igual nivel, el que llegó antes va primero. Cualquier rol autenticado puede leerla. El profesional no puede clasificar (`403`).
Entrypoint / evidencia: [`src/triage/triage.controller.ts`](../src/triage/triage.controller.ts), [`src/triage/triage.ts`](../src/triage/triage.ts)

### B1 y B2 — Signos y medicación

1. Con un turno ya creado (F3) y el login del enfermero (`enfermero@turnos.local` / `Enfermero123!`) o del admin.
2. `POST /api/v1/appointments/:id/vitals` con `{ sistolica, diastolica, frecuenciaCardiaca, temperatura }`. Hasta 39 °C la bitácora anota «El control de signos salió bien». Si la temperatura lo supera, `fueraDeRango` es true y el log `[guardia]` avisa.
3. Como profesional o admin: `POST /api/v1/patients/:patientId/prescriptions` con `{ supplyId, dosis, cadaHoras }`. El `supplyId` sale de `GET /api/v1/supplies`.
4. Como enfermero: `POST /api/v1/appointments/:id/doses` con `{ indicacionId, horaIndicada, administradaEn }`. Entra solo si `administradaEn` está a ±30 minutos de `horaIndicada`. Si no, `400`. La nota queda con `kind: "medicacion"` y el nombre de quien la dio.
5. La dosis descuenta 1 unidad del insumo (`stockRestante` en la respuesta). Sin stock, `409`.
Entrypoint / evidencia: [`src/nursing/nursing.controller.ts`](../src/nursing/nursing.controller.ts), [`src/nursing/nursing.ts`](../src/nursing/nursing.ts)

### B3, C1 y C2 — Internación y camas

1. Como secretaría o admin, `GET /api/v1/beds` para ver las camas `libre`.
2. `POST /api/v1/admissions` con `{ patientId, bedId, reason }` (`cirugia`, `respiratorio` o `pediatria`). Resultado: `201`, la cama queda `ocupada` y la internación trae `protocolTasks`. Cama no libre o paciente ya internado → `409`.
3. Alta: `POST /api/v1/admissions/:id/discharge`. La cama pasa a `en_limpieza` y no admite a nadie.
4. Como enfermero o admin, `PATCH /api/v1/beds/:id/status` con `{ "status": "libre" }` cuando la limpieza terminó. `libre` ↔ `bloqueada` para mantenimiento.
Entrypoint / evidencia: [`src/admissions/admissions.service.ts`](../src/admissions/admissions.service.ts), [`src/beds/bed-status.ts`](../src/beds/bed-status.ts)

### C3, D1 y D2 — Stock y facturación

1. Admin carga o repone insumos con `POST /api/v1/supplies` y `PATCH /api/v1/supplies/:id`.
2. Cobertura: `PATCH /api/v1/patients/:id` con `{ "coverage": "prepaga", "copay": 3000 }`.
3. Facturar la consulta: `POST /api/v1/appointments/:id/charges` con `{ "price": 15000 }`. Prepaga con copago 3000 → paciente 3000 y prepaga 12000. Pública → paciente 0 y Estado 15000. Segunda vez → `409`.
4. Si el paciente está internado, cada dosis suma «Insumos de Farmacia» a `GET /api/v1/admissions/:id/account`.
Entrypoint / evidencia: [`src/billing/coverage.ts`](../src/billing/coverage.ts), [`src/billing/billing.service.ts`](../src/billing/billing.service.ts)

## Scripts útiles (por flujo)

| Script | Flujos | Qué hace |
|--------|--------|----------|
| `npm run start:dev` | F1–F5 | Nest watch |
| `npm start` | F1–F5 | Arranque sin watch |
| `npm run start:prod` | F1–F5 | `node dist/main` tras `npm run build` |
| `npm run seed` | F1–F4, C1–C3, D1–D2 | Secretaría, enfermero, cinco médicos, 20 turnos, camas en los cuatro estados, cargos por cobertura y cuenta de internación |
| `npm run prisma:push` | F2–F5 | `prisma db push` al Postgres de `DATABASE_URL` |
| `npm test` | F3, A5, B1–B3, C2, D1 | Jest unitario (entreturno, estados, triaje, fiebre, ventana de dosis, protocolos, estados de cama, cobertura, TZ) |
| `npm run test:e2e` | F1, F3–F5, B2, C1–C3, D1, D2 | Turnos, lista de espera, entreturno, estados, bitácora; internación con doble asignación, dosis con stock y cuenta, facturación prepaga |
| `npm run lint` / `npm run format` | — | ESLint --fix / Prettier; no son flujos de negocio |

## Tip de onboarding

Primero `npm run seed` y **F1** con `secretaria@turnos.local`. El seed ya deja sucursal, cinco médicos, disponibilidad, 20 turnos del 9 al 13 de noviembre de 2026, una internación activa y cargos por cobertura. Swagger: http://localhost:3000/docs
