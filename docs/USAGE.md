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

Base: `http://localhost:3000/api/v1`. F1 usa las cuentas del seed: `secretaria@turnos.local` / `Secretaria123!`, y los médicos `ana.perez@turnos.local` y `luis.gomez@turnos.local` / `Medico123!`.

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
Entrypoint / evidencia: [`src/appointments/appointments.controller.ts`](../src/appointments/appointments.controller.ts), [`src/appointments/status/status-transitions.ts`](../src/appointments/status/status-transitions.ts)

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
3. Resultado esperado: `200` y notas en orden (`Creó el turno`, `Canceló el turno`, etc.) con `authorName`. Profesional → `403`.
Entrypoint / evidencia: [`src/binnacle/binnacle.controller.ts`](../src/binnacle/binnacle.controller.ts)

## Scripts útiles (por flujo)

| Script | Flujos | Qué hace |
|--------|--------|----------|
| `npm run start:dev` | F1–F5 | Nest watch |
| `npm start` | F1–F5 | Arranque sin watch |
| `npm run start:prod` | F1–F5 | `node dist/main` tras `npm run build` |
| `npm run seed` | F1–F4 | Secretaría, dos médicos, catálogo mínimo y 3 turnos |
| `npm run prisma:push` | F2–F5 | `prisma db push` al Postgres de `DATABASE_URL` |
| `npm test` | F3 | Jest unitario (solape, estados, TZ) |
| `npm run test:e2e` | F1, F3–F5 | Secretaría crea, solape 409, profesional 403, bitácora |
| `npm run lint` / `npm run format` | — | ESLint --fix / Prettier; no son flujos de negocio |

## Tip de onboarding

Primero `npm run seed` y **F1** con `secretaria@turnos.local`. El seed ya deja sucursal, médicos, disponibilidad, pacientes y tres turnos el lunes 2026-10-05. Swagger: http://localhost:3000/docs
