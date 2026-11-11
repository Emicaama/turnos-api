# Endpoints

## Resumen

API REST NestJS con prefijo global `api/v1` ([`src/main.ts`](../src/main.ts)). Auth JWT Bearer en todas las rutas salvo las marcadas `@Public()` (solo login). `RolesGuard` global: sin `@Roles` basta estar autenticado; con `@Roles` hace falta ese rol ([`src/app.module.ts`](../src/app.module.ts)). POST Nest responde `201`. Validación: `400` si el body/query no cumple class-validator. Documentación interactiva (no es un recurso de negocio): `GET /docs`.

IDs: campo `id` UUID (Prisma). Roles: `admin` | `secretaria` | `profesional` | `enfermero`. Estados de turno: `programado` | `en_sala_de_espera` | `atendido` | `cancelado`. Niveles de triaje: `rojo` | `amarillo` | `verde`. Estados de cama: `libre` | `ocupada` | `en_limpieza` | `bloqueada`. Motivos de internación: `cirugia` | `respiratorio` | `pediatria`. Coberturas: `publica` | `prepaga` | `particular`. Montos en pesos enteros.

`GET /api/v1/health` es público y responde `{ "status": "ok", "postgres": true }` si Postgres acepta `SELECT 1` ([`src/health/health.controller.ts`](../src/health/health.controller.ts)).

## Índice

| Método | URL | Qué hace (corto) | Flujos | Evidencia |
|--------|-----|------------------|--------|-----------|
| GET | `/api/v1/health` | Ping de Postgres | — | [`src/health/health.controller.ts`](../src/health/health.controller.ts) |
| POST | `/api/v1/auth/login` | Emite JWT | F1 | [`src/auth/auth.controller.ts`](../src/auth/auth.controller.ts) |
| GET | `/api/v1/users/me` | Devuelve el payload del token | F1 | [`src/users/users.controller.ts`](../src/users/users.controller.ts) |
| GET | `/api/v1/users` | Lista usuarios (sin hash) | F1, F2 | [`src/users/users.controller.ts`](../src/users/users.controller.ts) |
| POST | `/api/v1/users` | Crea usuario | F1, F2 | [`src/users/users.controller.ts`](../src/users/users.controller.ts) |
| PATCH | `/api/v1/users/:id` | Edita o deshabilita usuario | F1, F2 | [`src/users/users.controller.ts`](../src/users/users.controller.ts) |
| GET | `/api/v1/branches` | Lista sucursales | F2 | [`src/branches/branches.controller.ts`](../src/branches/branches.controller.ts) |
| GET | `/api/v1/branches/:id` | Obtiene sucursal | F2 | [`src/branches/branches.controller.ts`](../src/branches/branches.controller.ts) |
| POST | `/api/v1/branches` | Crea sucursal | F2 | [`src/branches/branches.controller.ts`](../src/branches/branches.controller.ts) |
| PATCH | `/api/v1/branches/:id` | Actualiza sucursal | F2 | [`src/branches/branches.controller.ts`](../src/branches/branches.controller.ts) |
| GET | `/api/v1/specialties` | Lista especialidades | F2 | [`src/specialties/specialties.controller.ts`](../src/specialties/specialties.controller.ts) |
| GET | `/api/v1/specialties/:id` | Obtiene especialidad | F2 | [`src/specialties/specialties.controller.ts`](../src/specialties/specialties.controller.ts) |
| POST | `/api/v1/specialties` | Crea especialidad | F2 | [`src/specialties/specialties.controller.ts`](../src/specialties/specialties.controller.ts) |
| PATCH | `/api/v1/specialties/:id` | Edita especialidad | F2 | [`src/specialties/specialties.controller.ts`](../src/specialties/specialties.controller.ts) |
| DELETE | `/api/v1/specialties/:id` | Elimina especialidad sin médicos | F2 | [`src/specialties/specialties.service.ts`](../src/specialties/specialties.service.ts) |
| GET | `/api/v1/patients` | Lista pacientes | F2 | [`src/patients/patients.controller.ts`](../src/patients/patients.controller.ts) |
| GET | `/api/v1/patients/:id` | Obtiene paciente | F2 | [`src/patients/patients.controller.ts`](../src/patients/patients.controller.ts) |
| POST | `/api/v1/patients` | Crea paciente | F2 | [`src/patients/patients.controller.ts`](../src/patients/patients.controller.ts) |
| PATCH | `/api/v1/patients/:id` | Actualiza paciente | F2 | [`src/patients/patients.controller.ts`](../src/patients/patients.controller.ts) |
| GET | `/api/v1/professionals` | Lista profesionales | F2 | [`src/professionals/professionals.controller.ts`](../src/professionals/professionals.controller.ts) |
| GET | `/api/v1/professionals/:id` | Obtiene profesional | F2 | [`src/professionals/professionals.controller.ts`](../src/professionals/professionals.controller.ts) |
| POST | `/api/v1/professionals` | Crea profesional | F2 | [`src/professionals/professionals.controller.ts`](../src/professionals/professionals.controller.ts) |
| PATCH | `/api/v1/professionals/:id` | Actualiza profesional | F2 | [`src/professionals/professionals.controller.ts`](../src/professionals/professionals.controller.ts) |
| GET | `/api/v1/professionals/:id/agenda` | Agenda en un rango | F4 | [`src/appointments/professionals-agenda.controller.ts`](../src/appointments/professionals-agenda.controller.ts) |
| GET | `/api/v1/availability` | Lista franjas | F2 | [`src/availability/availability.controller.ts`](../src/availability/availability.controller.ts) |
| POST | `/api/v1/availability` | Crea franja semanal | F2 | [`src/availability/availability.controller.ts`](../src/availability/availability.controller.ts) |
| PATCH | `/api/v1/availability/:id` | Edita franja (horario, sala, modalidad, estado) | F2 | [`src/availability/availability.controller.ts`](../src/availability/availability.controller.ts) |
| POST | `/api/v1/appointments` | Programa un turno o encola la lista de espera | F3 | [`src/appointments/appointments.controller.ts`](../src/appointments/appointments.controller.ts) |
| GET | `/api/v1/appointments` | Lista/filtra turnos | F3 | [`src/appointments/appointments.controller.ts`](../src/appointments/appointments.controller.ts) |
| GET | `/api/v1/appointments/:id` | Obtiene un turno | F3 | [`src/appointments/appointments.controller.ts`](../src/appointments/appointments.controller.ts) |
| PATCH | `/api/v1/appointments/:id` | Estado, notas o reprogramación | F3 | [`src/appointments/appointments.controller.ts`](../src/appointments/appointments.controller.ts) |
| POST | `/api/v1/appointments/:id/cancel` | Cancela turno | F3 | [`src/appointments/appointments.controller.ts`](../src/appointments/appointments.controller.ts) |
| POST | `/api/v1/appointments/:id/vitals` | Registra signos del turno | B1 | [`src/nursing/nursing.controller.ts`](../src/nursing/nursing.controller.ts) |
| GET | `/api/v1/patients/:id/prescriptions` | Indicaciones del paciente | B2 | [`src/nursing/nursing.controller.ts`](../src/nursing/nursing.controller.ts) |
| POST | `/api/v1/patients/:id/prescriptions` | Crea una indicación | B2 | [`src/nursing/nursing.controller.ts`](../src/nursing/nursing.controller.ts) |
| POST | `/api/v1/appointments/:id/doses` | Marca una dosis administrada en horario | B2 | [`src/nursing/nursing.controller.ts`](../src/nursing/nursing.controller.ts) |
| GET | `/api/v1/binnacle/:appointmentId` | Bitácora del turno | F5, B1, B2 | [`src/binnacle/binnacle.controller.ts`](../src/binnacle/binnacle.controller.ts) |
| POST | `/api/v1/triage` | Clasifica un paciente en la guardia | A5 | [`src/triage/triage.controller.ts`](../src/triage/triage.controller.ts) |
| GET | `/api/v1/triage` | Cola de guardia de una sucursal | A5 | [`src/triage/triage.controller.ts`](../src/triage/triage.controller.ts) |
| GET | `/api/v1/supplies` | Lista insumos con stock y precio | C3 | [`src/supplies/supplies.controller.ts`](../src/supplies/supplies.controller.ts) |
| POST | `/api/v1/supplies` | Crea insumo | C3 | [`src/supplies/supplies.controller.ts`](../src/supplies/supplies.controller.ts) |
| PATCH | `/api/v1/supplies/:id` | Repone stock o cambia precio | C3, D2 | [`src/supplies/supplies.controller.ts`](../src/supplies/supplies.controller.ts) |
| GET | `/api/v1/beds` | Mapa de camas | C1, C2 | [`src/beds/beds.controller.ts`](../src/beds/beds.controller.ts) |
| POST | `/api/v1/beds` | Crea cama | C1 | [`src/beds/beds.controller.ts`](../src/beds/beds.controller.ts) |
| PATCH | `/api/v1/beds/:id/status` | Limpieza terminada o bloqueo | C2 | [`src/beds/beds.controller.ts`](../src/beds/beds.controller.ts) |
| POST | `/api/v1/admissions` | Interna en una cama libre y genera el protocolo | C1, B3 | [`src/admissions/admissions.controller.ts`](../src/admissions/admissions.controller.ts) |
| GET | `/api/v1/admissions` | Internaciones activas | C1, B3 | [`src/admissions/admissions.controller.ts`](../src/admissions/admissions.controller.ts) |
| GET | `/api/v1/admissions/:id` | Internación con su protocolo | B3 | [`src/admissions/admissions.controller.ts`](../src/admissions/admissions.controller.ts) |
| POST | `/api/v1/admissions/:id/discharge` | Alta: la cama pasa a limpieza | C2 | [`src/admissions/admissions.controller.ts`](../src/admissions/admissions.controller.ts) |
| GET | `/api/v1/admissions/:id/account` | Cuenta de la estadía | D2 | [`src/billing/billing.controller.ts`](../src/billing/billing.controller.ts) |
| POST | `/api/v1/appointments/:id/charges` | Factura la consulta según cobertura | D1 | [`src/billing/billing.controller.ts`](../src/billing/billing.controller.ts) |

Errores transversales (guards / ValidationPipe): `401` sin Bearer válido; `403` rol insuficiente; `400` body/query inválido.

## Detalle

### `POST /api/v1/auth/login`

**Qué hace:** Valida email/password (bcrypt) y firma un JWT con id, email, name, role y `professionalId` opcional.

| | |
|--|--|
| Auth | Pública (`@Public`) |
| Path params | Sin path params |
| Query | Sin query |
| Body | JSON (abajo) |
| Respuesta OK | `201` `{ "accessToken": string }` |
| Errores | `401` credenciales inválidas; `400` email/password inválidos |
| Evidencia | [`src/auth/auth.controller.ts`](../src/auth/auth.controller.ts), [`src/auth/auth.service.ts`](../src/auth/auth.service.ts) |
| Flujos | F1 |

**Body:**

```json
{
  "email": "secretaria@turnos.local",
  "password": "Secretaria123!"
}
```

`email` (`@IsEmail`), `password` string min 8 ([`src/auth/dto/login.dto.ts`](../src/auth/dto/login.dto.ts)). El ejemplo coincide con la secretaría del seed ([`src/seed/seed.service.ts`](../src/seed/seed.service.ts)).

**Respuesta (ejemplo):**

```json
{ "accessToken": "<jwt>" }
```

---

### `GET /api/v1/users/me`

**Qué hace:** Devuelve el usuario del JWT (no consulta Prisma).

| | |
|--|--|
| Auth | Bearer; cualquier rol autenticado |
| Path params | Sin path params |
| Query | Sin query |
| Body | Sin body |
| Respuesta OK | `200` |
| Errores | `401` |
| Evidencia | [`src/users/users.controller.ts`](../src/users/users.controller.ts), [`src/auth/auth-user.ts`](../src/auth/auth-user.ts) |
| Flujos | F1 |

**Respuesta (ejemplo):**

```json
{
  "id": "66b000000000000000000001",
  "email": "secretaria@turnos.local",
  "name": "Secretaría Central",
  "role": "secretaria",
  "professionalId": "66b0000000000000000000aa"
}
```

`professionalId` solo si venía en el token.

---

### `GET /api/v1/users`

**Qué hace:** Lista usuarios ordenados por `createdAt` desc, sin `passwordHash`.

| | |
|--|--|
| Auth | Bearer; rol `admin` |
| Path params | Sin path params |
| Query | Sin query |
| Body | Sin body |
| Respuesta OK | `200` array de usuarios públicos |
| Errores | `401`, `403` |
| Evidencia | [`src/users/users.controller.ts`](../src/users/users.controller.ts), [`src/users/users.service.ts`](../src/users/users.service.ts) |
| Flujos | F1, F2 |

---

### `POST /api/v1/users`

**Qué hace:** Crea usuario con password hasheado. Email único en minúsculas.

| | |
|--|--|
| Auth | Bearer; rol `admin` |
| Path params | Sin path params |
| Query | Sin query |
| Body | JSON (abajo) |
| Respuesta OK | `201` usuario sin `passwordHash` |
| Errores | `409` email duplicado; `400`; `401`; `403` |
| Evidencia | [`src/users/users.controller.ts`](../src/users/users.controller.ts), [`src/users/dto/create-user.dto.ts`](../src/users/dto/create-user.dto.ts) |
| Flujos | F1, F2 |

**Body:**

```json
{
  "email": "otro@turnos.local",
  "password": "Password1",
  "name": "Otro Admin",
  "role": "admin",
  "professionalId": "66b0000000000000000000aa"
}
```

`role` enum `admin` | `secretaria` | `profesional` | `enfermero`. `professionalId` opcional, UUID. `active` opcional (default `true`).

---

### `PATCH /api/v1/users/:id`

**Qué hace:** Actualiza campos opcionales del usuario. `password` solo se re-hashea si viene. `active: false` deshabilita la cuenta: el login responde `401` «La cuenta está deshabilitada» (los tokens ya emitidos siguen valiendo hasta que vencen).

| | |
|--|--|
| Auth | Bearer; rol `admin` |
| Path params | `id` |
| Body | JSON parcial de create; `professionalId` acepta `null` para desvincular |
| Respuesta OK | `200` usuario sin `passwordHash` |
| Errores | `404`; `409` email duplicado; `400`; `401`; `403` |
| Evidencia | [`src/users/users.service.ts`](../src/users/users.service.ts), [`src/auth/auth.service.ts`](../src/auth/auth.service.ts) |
| Flujos | F1, F2 |

---

### `GET /api/v1/branches`

**Qué hace:** Lista sucursales ordenadas por nombre.

| | |
|--|--|
| Auth | Bearer; cualquier rol autenticado |
| Path params | Sin path params |
| Query | Sin query |
| Body | Sin body |
| Respuesta OK | `200` array |
| Errores | `401` |
| Evidencia | [`src/branches/branches.controller.ts`](../src/branches/branches.controller.ts) |
| Flujos | F2 |

**Respuesta (ejemplo):**

```json
[
  {
    "id": "66b000000000000000000010",
    "name": "Sede Centro",
    "address": "Av. Principal 100",
    "createdAt": "2026-08-18T15:00:00.000Z",
    "updatedAt": "2026-08-18T15:00:00.000Z"
  }
]
```

---

### `GET /api/v1/branches/:id`

**Qué hace:** Devuelve una sucursal por id.

| | |
|--|--|
| Auth | Bearer; cualquier rol autenticado |
| Path params | `id` UUID |
| Query | Sin query |
| Body | Sin body |
| Respuesta OK | `200` un documento Branch |
| Errores | `404` sucursal no encontrada; `401` |
| Evidencia | [`src/branches/branches.service.ts`](../src/branches/branches.service.ts) |
| Flujos | F2 |

---

### `POST /api/v1/branches`

**Qué hace:** Crea sucursal.

| | |
|--|--|
| Auth | Bearer; rol `admin` |
| Path params | Sin path params |
| Query | Sin query |
| Body | JSON |
| Respuesta OK | `201` sucursal creada |
| Errores | `400` name/address min 2; `401`; `403` |
| Evidencia | [`src/branches/dto/create-branch.dto.ts`](../src/branches/dto/create-branch.dto.ts) |
| Flujos | F2 |

**Body:**

```json
{ "name": "Sede Norte", "address": "Calle 1" }
```

---

### `PATCH /api/v1/branches/:id`

**Qué hace:** Actualiza name y/o address (campos opcionales).

| | |
|--|--|
| Auth | Bearer; rol `admin` |
| Path params | `id` |
| Query | Sin query |
| Body | JSON parcial de create |
| Respuesta OK | `200` sucursal actualizada |
| Errores | `404`; `400`; `401`; `403` |
| Evidencia | [`src/branches/dto/update-branch.dto.ts`](../src/branches/dto/update-branch.dto.ts) |
| Flujos | F2 |

**Body:**

```json
{ "address": "Calle 2" }
```

---

### `GET /api/v1/specialties`

**Qué hace:** Lista especialidades ordenadas por nombre.

| | |
|--|--|
| Auth | Bearer; cualquier rol autenticado |
| Path params | Sin path params |
| Query | Sin query |
| Body | Sin body |
| Respuesta OK | `200` array `{ id, name, createdAt, updatedAt }` |
| Errores | `401` |
| Evidencia | [`src/specialties/specialties.controller.ts`](../src/specialties/specialties.controller.ts) |
| Flujos | F2 |

---

### `GET /api/v1/specialties/:id`

**Qué hace:** Obtiene una especialidad.

| | |
|--|--|
| Auth | Bearer; cualquier rol autenticado |
| Path params | `id` |
| Query | Sin query |
| Body | Sin body |
| Respuesta OK | `200` |
| Errores | `404` especialidad no encontrada; `401` |
| Evidencia | [`src/specialties/specialties.service.ts`](../src/specialties/specialties.service.ts) |
| Flujos | F2 |

---

### `POST /api/v1/specialties`

**Qué hace:** Crea especialidad (`name` único a nivel schema).

| | |
|--|--|
| Auth | Bearer; rol `admin` |
| Path params | Sin path params |
| Query | Sin query |
| Body | JSON |
| Respuesta OK | `201` |
| Errores | `400` name min 2; `409` nombre repetido; `401`; `403` |
| Evidencia | [`src/specialties/dto/create-specialty.dto.ts`](../src/specialties/dto/create-specialty.dto.ts) |
| Flujos | F2 |

**Body:**

```json
{ "name": "Cardiología", "description": "Corazón y sistema circulatorio", "icon": "bi-heart-pulse", "active": true }
```

`description`, `icon` (clase de Bootstrap Icons) y `active` (default `true`) son opcionales.

---

### `PATCH /api/v1/specialties/:id` · `DELETE /api/v1/specialties/:id`

**Qué hace:** `PATCH` actualiza campos opcionales. `DELETE` borra la especialidad solo si ningún profesional la tiene en `specialtyIds`; si está en uso responde `409` y conviene pasarla a `active: false`.

| | |
|--|--|
| Auth | Bearer; rol `admin` |
| Path params | `id` |
| Respuesta OK | `200` especialidad |
| Errores | `404`; `409` nombre repetido o especialidad con médicos; `400`; `401`; `403` |
| Evidencia | [`src/specialties/specialties.service.ts`](../src/specialties/specialties.service.ts) |
| Flujos | F2 |

---

### `GET /api/v1/patients`

**Qué hace:** Lista pacientes ordenados por apellido y nombre.

| | |
|--|--|
| Auth | Bearer; cualquier rol autenticado |
| Path params | Sin path params |
| Query | Sin query |
| Body | Sin body |
| Respuesta OK | `200` array |
| Errores | `401` |
| Evidencia | [`src/patients/patients.controller.ts`](../src/patients/patients.controller.ts) |
| Flujos | F2 |

**Respuesta (ejemplo):**

```json
[
  {
    "id": "66b000000000000000000020",
    "firstName": "Ana",
    "lastName": "Paciente",
    "documentId": "30111222",
    "email": "ana@turnos.local",
    "phone": "1112345678",
    "createdAt": "2026-08-18T15:00:00.000Z",
    "updatedAt": "2026-08-18T15:00:00.000Z"
  }
]
```

---

### `GET /api/v1/patients/:id`

**Qué hace:** Obtiene un paciente.

| | |
|--|--|
| Auth | Bearer; cualquier rol autenticado |
| Path params | `id` |
| Query | Sin query |
| Body | Sin body |
| Respuesta OK | `200` |
| Errores | `404` paciente no encontrado; `401` |
| Evidencia | [`src/patients/patients.service.ts`](../src/patients/patients.service.ts) |
| Flujos | F2 |

---

### `POST /api/v1/patients`

**Qué hace:** Alta de paciente. `documentId` único.

| | |
|--|--|
| Auth | Bearer; roles `admin` o `secretaria` |
| Path params | Sin path params |
| Query | Sin query |
| Body | JSON |
| Respuesta OK | `201` |
| Errores | `409` documento duplicado; `400`; `401`; `403` |
| Evidencia | [`src/patients/dto/create-patient.dto.ts`](../src/patients/dto/create-patient.dto.ts) |
| Flujos | F2 |

**Body:**

```json
{
  "firstName": "Ana",
  "lastName": "Paciente",
  "documentId": "30111222",
  "email": "ana@turnos.local",
  "phone": "1112345678",
  "coverage": "prepaga",
  "copay": 3000
}
```

`email`, `phone`, `coverage` (default `particular`) y `copay` (entero ≥ 0, default 0; es el copago fijo de la prepaga) opcionales. También opcionales: `birthDate` (`YYYY-MM-DD`), `address`, `insurer` (nombre de la obra social), `affiliateNumber`, `emergencyContact`, `notes` y `active` (default `true`). En `PATCH`, mandar `null` en un campo opcional lo borra.

---

### `PATCH /api/v1/patients/:id`

**Qué hace:** Actualiza campos opcionales del paciente.

| | |
|--|--|
| Auth | Bearer; roles `admin` o `secretaria` |
| Path params | `id` |
| Query | Sin query |
| Body | JSON parcial de create |
| Respuesta OK | `200` |
| Errores | `404`; `400`; `401`; `403` |
| Evidencia | [`src/patients/dto/update-patient.dto.ts`](../src/patients/dto/update-patient.dto.ts) |
| Flujos | F2 |

---

### `GET /api/v1/professionals`

**Qué hace:** Lista profesionales ordenados por apellido.

| | |
|--|--|
| Auth | Bearer; cualquier rol autenticado |
| Path params | Sin path params |
| Query | Sin query |
| Body | Sin body |
| Respuesta OK | `200` array |
| Errores | `401` |
| Evidencia | [`src/professionals/professionals.controller.ts`](../src/professionals/professionals.controller.ts) |
| Flujos | F2 |

**Respuesta (ejemplo):**

```json
[
  {
    "id": "66b0000000000000000000aa",
    "firstName": "Demo",
    "lastName": "Médico",
    "userId": "66b000000000000000000003",
    "specialtyIds": ["66b000000000000000000011"],
    "branchIds": ["66b000000000000000000010"],
    "createdAt": "2026-08-18T15:00:00.000Z",
    "updatedAt": "2026-08-18T15:00:00.000Z"
  }
]
```

---

### `GET /api/v1/professionals/:id`

**Qué hace:** Obtiene un profesional. Distinto de `.../:id/agenda`.

| | |
|--|--|
| Auth | Bearer; cualquier rol autenticado |
| Path params | `id` |
| Query | Sin query |
| Body | Sin body |
| Respuesta OK | `200` |
| Errores | `404` profesional no encontrado; `401` |
| Evidencia | [`src/professionals/professionals.service.ts`](../src/professionals/professionals.service.ts) |
| Flujos | F2 |

---

### `POST /api/v1/professionals`

**Qué hace:** Crea profesional y, si hay `userId`, enlaza `User.professionalId`.

| | |
|--|--|
| Auth | Bearer; rol `admin` |
| Path params | Sin path params |
| Query | Sin query |
| Body | JSON |
| Respuesta OK | `201` |
| Errores | `400`; `401`; `403` |
| Evidencia | [`src/professionals/dto/create-professional.dto.ts`](../src/professionals/dto/create-professional.dto.ts) |
| Flujos | F2 |

**Body:**

```json
{
  "firstName": "Demo",
  "lastName": "Médico",
  "userId": "66b000000000000000000003",
  "specialtyIds": ["66b000000000000000000011"],
  "branchIds": ["66b000000000000000000010"]
}
```

`userId`, `specialtyIds` y `branchIds` opcionales. También opcionales: `licenseNumber` (matrícula), `phone`, `email`, `office` (consultorio), `notes` y `status` (`activo` | `licencia` | `inactivo`, default `activo`). Un profesional que no está `activo` no recibe turnos nuevos (`400` «El profesional no está habilitado para recibir turnos»).

---

### `PATCH /api/v1/professionals/:id`

**Qué hace:** Actualiza datos y arrays de especialidad/sucursal.

| | |
|--|--|
| Auth | Bearer; rol `admin` |
| Path params | `id` |
| Query | Sin query |
| Body | JSON parcial de create |
| Respuesta OK | `200` |
| Errores | `404`; `400`; `401`; `403` |
| Evidencia | [`src/professionals/dto/update-professional.dto.ts`](../src/professionals/dto/update-professional.dto.ts) |
| Flujos | F2 |

---

### `GET /api/v1/professionals/:id/agenda`

**Qué hace:** Lista turnos del profesional en `[from, to]` por `startAt`, excluyendo `cancelado`. Un `profesional` solo puede pedir su propio id.

| | |
|--|--|
| Auth | Bearer; autenticado. Restricción extra en servicio si rol `profesional` |
| Path params | `id` del profesional |
| Query | `from`, `to` (ISO, obligatorios) |
| Body | Sin body |
| Respuesta OK | `200` array de Appointment |
| Errores | `400` query inválida; `403` agenda ajena; `404` profesional inexistente; `401` |
| Evidencia | [`src/appointments/professionals-agenda.controller.ts`](../src/appointments/professionals-agenda.controller.ts), [`src/appointments/dto/agenda-query.dto.ts`](../src/appointments/dto/agenda-query.dto.ts) |
| Flujos | F4 |

---

### `GET /api/v1/availability`

**Qué hace:** Lista franjas; opcionalmente filtra por profesional.

| | |
|--|--|
| Auth | Bearer; cualquier rol autenticado |
| Path params | Sin path params |
| Query | `professionalId` opcional (string sin DTO; el controller no valida UUID) |
| Body | Sin body |
| Respuesta OK | `200` array ordenado por weekday y startTime |
| Errores | `401` |
| Evidencia | [`src/availability/availability.controller.ts`](../src/availability/availability.controller.ts) |
| Flujos | F2 |

**Respuesta (ejemplo):**

```json
[
  {
    "id": "66b000000000000000000030",
    "professionalId": "66b0000000000000000000aa",
    "branchId": "66b000000000000000000010",
    "weekday": 1,
    "startTime": "09:00",
    "endTime": "17:00",
    "slotMinutes": 30,
    "createdAt": "2026-08-18T15:00:00.000Z",
    "updatedAt": "2026-08-18T15:00:00.000Z"
  }
]
```

`weekday`: 0 domingo … 6 sábado.

---

### `POST /api/v1/availability`

**Qué hace:** Crea franja semanal. Unique compuesto `professionalId + branchId + weekday + startTime` en Prisma. Solo las franjas con `status: activo` habilitan reservas.

| | |
|--|--|
| Auth | Bearer; roles `admin` o `secretaria` |
| Path params | Sin path params |
| Query | Sin query |
| Body | JSON |
| Respuesta OK | `201` |
| Errores | `400` (weekday 0–6, horas `HH:mm`, inicio anterior al fin, slotMinutes ≥ 5); `409` franja repetida; `401`; `403` |
| Evidencia | [`src/availability/dto/create-availability.dto.ts`](../src/availability/dto/create-availability.dto.ts) |
| Flujos | F2 |

**Body:**

```json
{
  "professionalId": "66b0000000000000000000aa",
  "branchId": "66b000000000000000000010",
  "weekday": 1,
  "startTime": "09:00",
  "endTime": "17:00",
  "slotMinutes": 30,
  "room": "Consultorio 104",
  "modality": "presencial",
  "status": "activo"
}
```

`room`, `modality` (`presencial` | `telemedicina` | `mixta`, default `presencial`) y `status` (`activo` | `suspendido` | `licencia`, default `activo`) son opcionales. `PATCH /api/v1/availability/:id` (mismos roles) acepta el mismo body parcial salvo `professionalId`.

---

### `POST /api/v1/appointments`

**Qué hace:** Si el horario está libre, crea un turno `programado`. Si ya hay un turno activo ahí, anota al paciente en la lista de espera del profesional, la sucursal y el día (mismo endpoint). Con `entreturno: true` acorta el turno que cubre un inicio `:15` o `:45`. La escritura corre en una transacción serializable. Si dos altas llegan juntas a un hueco libre, la que pierde responde `409`.

| | |
|--|--|
| Auth | Bearer; roles `admin` o `secretaria` |
| Path params | Sin path params |
| Query | Sin query |
| Body | JSON |
| Respuesta OK | `201` `{ result: "programado", appointment, acortado? }` o `{ result: "lista_de_espera", waitlist }` |
| Errores | `403` profesional (guard o servicio); `409` el hueco acaba de ocuparse; `400` fuera de franja, entreturno inválido, rango invertido, catálogo inválido; `404` paciente/profesional/sucursal; `401` |
| Evidencia | [`src/appointments/appointments.controller.ts`](../src/appointments/appointments.controller.ts), [`src/appointments/appointments.service.ts`](../src/appointments/appointments.service.ts) |
| Flujos | F3 |

**Body:**

```json
{
  "patientId": "66b000000000000000000020",
  "professionalId": "66b0000000000000000000aa",
  "branchId": "66b000000000000000000010",
  "startAt": "2026-08-17T12:00:00.000Z",
  "endAt": "2026-08-17T12:30:00.000Z",
  "notes": "Primera vez",
  "entreturno": false
}
```

`notes` y `entreturno` opcionales. `startAt`/`endAt` ISO (`@IsDateString`). `entreturno: true` exige inicio `:15` o `:45` en `CLINIC_TZ` y que `endAt` sea el fin del turno que se acorta.

**Respuesta (ejemplo, hueco libre):**

```json
{
  "result": "programado",
  "appointment": {
    "id": "66b000000000000000000040",
    "patientId": "66b000000000000000000020",
    "professionalId": "66b0000000000000000000aa",
    "branchId": "66b000000000000000000010",
    "startAt": "2026-08-17T12:00:00.000Z",
    "endAt": "2026-08-17T12:30:00.000Z",
    "status": "programado",
    "entreturno": false,
    "acortado": false,
    "notes": "Primera vez",
    "createdAt": "2026-08-18T15:00:00.000Z",
    "updatedAt": "2026-08-18T15:00:00.000Z"
  }
}
```

Si el horario ya estaba ocupado, `result` es `lista_de_espera` y el cuerpo trae `waitlist` (`patientId`, `professionalId`, `branchId`, `day`) en lugar de `appointment`.

---

### `GET /api/v1/appointments`

**Qué hace:** Lista turnos ordenados por `startAt`. El rol `profesional` se filtra a su `professionalId` del token (ignora query de otro profesional).

| | |
|--|--|
| Auth | Bearer; autenticado |
| Path params | Sin path params |
| Query | Opcionales: `status`, `professionalId`, `patientId`, `branchId`, `from`, `to` (ISO) |
| Body | Sin body |
| Respuesta OK | `200` array Appointment |
| Errores | `400` query inválida; `403` profesional sin `professionalId` en token; `401` |
| Evidencia | [`src/appointments/dto/list-appointments-query.dto.ts`](../src/appointments/dto/list-appointments-query.dto.ts) |
| Flujos | F3 |

---

### `GET /api/v1/appointments/:id`

**Qué hace:** Devuelve un turno. El profesional no ve turnos de otros.

| | |
|--|--|
| Auth | Bearer; autenticado + chequeo de visibilidad en servicio |
| Path params | `id` |
| Query | Sin query |
| Body | Sin body |
| Respuesta OK | `200` Appointment |
| Errores | `404`; `403`; `401` |
| Evidencia | [`src/appointments/appointments.controller.ts`](../src/appointments/appointments.controller.ts) |
| Flujos | F3 |

---

### `PATCH /api/v1/appointments/:id`

**Qué hace:** Si vienen `startAt`/`endAt`, reprograma (cancela el actual y crea otro `programado`). Si viene `status`, transiciona. Si solo `notes`, actualiza notas. El profesional no reprograma; solo puede pasar a `atendido`.

| | |
|--|--|
| Auth | Bearer; autenticado (reglas extra en servicio) |
| Path params | `id` |
| Query | Sin query |
| Body | JSON; todos los campos opcionales |
| Respuesta OK | `200` Appointment (el nuevo si reprogramó) |
| Errores | `400` transición o reprogramación inválida / fuera de disponibilidad; `403`; `404`; `409` solape al recrear; `401` |
| Evidencia | [`src/appointments/dto/update-appointment.dto.ts`](../src/appointments/dto/update-appointment.dto.ts), [`src/appointments/appointment-rules.ts`](../src/appointments/appointment-rules.ts) |
| Flujos | F3 |

**Body (cambio de estado):**

```json
{ "status": "en_sala_de_espera" }
```

**Body (reprogramar):**

```json
{
  "startAt": "2026-08-17T14:00:00.000Z",
  "endAt": "2026-08-17T14:30:00.000Z"
}
```

Transiciones: `programado` → `en_sala_de_espera` | `cancelado`; `en_sala_de_espera` → `atendido` | `cancelado`. `atendido` y `cancelado` no avanzan.

---

### `POST /api/v1/appointments/:id/cancel`

**Qué hace:** Pasa el turno a `cancelado` (misma máquina de estados). Anota `Canceló el turno` en la bitácora. Si hay lista de espera para ese profesional, sucursal y día, el primero de la cola queda `programado` en el hueco (`promoted` en la respuesta).

| | |
|--|--|
| Auth | Bearer; roles `admin` o `secretaria` |
| Path params | `id` |
| Query | Sin query |
| Body | Sin body |
| Respuesta OK | `201` Appointment con `status: "cancelado"` y, si hubo promoción, `promoted` (Nest POST) |
| Errores | `403` profesional; `400` si el estado actual no permite cancelar; `404`; `401` |
| Evidencia | [`src/appointments/appointments.controller.ts`](../src/appointments/appointments.controller.ts) |
| Flujos | F3 |

---

### `GET /api/v1/binnacle/:appointmentId`

**Qué hace:** Devuelve las notas de ese turno, de la más vieja a la más nueva. `kind` filtra `agenda`, `signos` o `medicacion`. Sin `kind`, admin y secretaría ven todas. El profesional solo puede pedir `signos` o `medicacion` de un turno propio.

| | |
|--|--|
| Auth | Bearer. Admin, secretaría y enfermero ven todo. El profesional solo `kind=signos` o `kind=medicacion` de su turno |
| Path params | `appointmentId` del turno |
| Query | `kind` opcional: `agenda`, `signos` o `medicacion` |
| Body | Sin body |
| Respuesta OK | `200` array de `BinnacleRecord` |
| Errores | `401`; `403` si el profesional pide la agenda o un turno ajeno; `404` si el profesional pide un turno que no existe |
| Evidencia | [`src/binnacle/binnacle.controller.ts`](../src/binnacle/binnacle.controller.ts), [`src/binnacle/binnacle.service.ts`](../src/binnacle/binnacle.service.ts) |
| Flujos | F5 |

**Respuesta (ejemplo):**

```json
[
  {
    "id": "7c1a0b2e-4f3d-4a1b-9c2e-111111111111",
    "appointmentId": "7c1a0b2e-4f3d-4a1b-9c2e-222222222222",
    "authorName": "Secretaría",
    "text": "Canceló el turno",
    "kind": "agenda",
    "createdAt": "2026-08-18T15:10:00.000Z"
  }
]
```

Cada nota de agenda es una frase: `Creó el turno`, `Creó un entreturno`, `Se acortó por un entreturno`, `Anunció al paciente en sala de espera`, `Marcó el turno como atendido`, `Canceló el turno`, `El horario pasó al primero de la lista de espera`, `Asignó el horario liberado desde la lista de espera`, `Reprogramó el turno` o `Creó el turno reprogramado`. Esas quedan con `kind: "agenda"`. Signos y medicación usan `kind: "signos"` y `kind: "medicacion"`.

---

### `POST /api/v1/appointments/:id/vitals`

**Qué hace:** Guarda presión, frecuencia y temperatura del turno. Hasta 39 °C anota «El control de signos salió bien». Si la temperatura lo supera, `fueraDeRango` es true y el log `[guardia]` avisa al médico de guardia.

| | |
|--|--|
| Auth | Bearer; roles `admin` o `enfermero` |
| Path params | `id` del turno |
| Query | Sin query |
| Body | JSON |
| Respuesta OK | `201` `VitalSign` |
| Errores | `404` turno; `400` body inválido; `403`; `401` |
| Evidencia | [`src/nursing/nursing.controller.ts`](../src/nursing/nursing.controller.ts), [`src/nursing/nursing.ts`](../src/nursing/nursing.ts) |
| Flujos | B1 |

**Body:**

```json
{ "sistolica": 120, "diastolica": 80, "frecuenciaCardiaca": 72, "temperatura": 36.6 }
```

---

### `POST /api/v1/patients/:id/prescriptions`

**Qué hace:** El médico indica un insumo del inventario al paciente. No administra ni descuenta stock.

| | |
|--|--|
| Auth | Bearer; roles `admin` o `profesional` |
| Path params | `id` del paciente |
| Query | Sin query |
| Body | JSON |
| Respuesta OK | `201` `Prescription` |
| Errores | `404` paciente o insumo; `400`; `403`; `401` |
| Evidencia | [`src/nursing/nursing.controller.ts`](../src/nursing/nursing.controller.ts) |
| Flujos | B2 |

**Body:**

```json
{ "supplyId": "7c1a0b2e-4f3d-4a1b-9c2e-333333333333", "dosis": "1 comprimido", "cadaHoras": 8 }
```

`GET /api/v1/patients/:id/prescriptions` (roles `admin`, `profesional` o `enfermero`) devuelve las indicaciones del paciente, de la más nueva a la más vieja; `404` si el paciente no existe.

---

### `POST /api/v1/appointments/:id/doses`

**Qué hace:** Marca una toma de una indicación de ese paciente. Solo si `administradaEn` cae a ±30 minutos de `horaIndicada`. En una sola transacción: descuenta 1 unidad del insumo (C3), guarda la toma, anota en la bitácora quién la aplicó y, si el paciente tiene una internación activa, agrega la línea «Insumos de Farmacia» con el precio vigente a la cuenta de la estadía (D2). Si algo falla, no queda nada a medias.

| | |
|--|--|
| Auth | Bearer; roles `admin` o `enfermero` |
| Path params | `id` del turno |
| Query | Sin query |
| Body | JSON |
| Respuesta OK | `201` `DoseAdministration` + `stockRestante` + `accountLine` (`null` si no está internado) |
| Errores | `400` fuera de la ventana; `404` turno o indicación de otro paciente; `409` sin stock; `403`; `401` |
| Evidencia | [`src/nursing/nursing.service.ts`](../src/nursing/nursing.service.ts), [`src/supplies/supplies.service.ts`](../src/supplies/supplies.service.ts) (`takeOneUnit`), [`src/billing/billing.service.ts`](../src/billing/billing.service.ts) (`chargeSupplyToActiveStay`) |
| Flujos | B2, C3, D2 |

**Body:**

```json
{
  "indicacionId": "66b0000000000000000000aa",
  "horaIndicada": "2026-10-27T17:00:00.000Z",
  "administradaEn": "2026-10-27T17:20:00.000Z"
}
```

---

### `POST /api/v1/triage`

**Qué hace:** Clasifica a un paciente que llega sin turno. `rojo` es riesgo vital y queda delante en la cola de la sucursal. `amarillo` y `verde` entran detrás. El rojo deja un log `[guardia]`. No crea un turno.

| | |
|--|--|
| Auth | Bearer; roles `admin`, `secretaria` o `enfermero` |
| Path params | Sin path params |
| Query | Sin query |
| Body | JSON |
| Respuesta OK | `201` `TriageEntry` |
| Errores | `400` nivel inválido; `404` paciente o sucursal; `401`; `403` |
| Evidencia | [`src/triage/triage.controller.ts`](../src/triage/triage.controller.ts), [`src/triage/triage.ts`](../src/triage/triage.ts) |
| Flujos | A5 |

**Body:**

```json
{
  "patientId": "66b0000000000000000000aa",
  "branchId": "66b000000000000000000010",
  "level": "rojo"
}
```

`level`: `rojo`, `amarillo` o `verde`.

---

### `GET /api/v1/triage`

**Qué hace:** Cola de guardia de una sucursal. Orden: `rojo`, después `amarillo`, después `verde`. A igual nivel, el que llegó antes va primero.

| | |
|--|--|
| Auth | Bearer; autenticado |
| Path params | Sin path params |
| Query | `branchId` (UUID, obligatorio) |
| Body | Sin body |
| Respuesta OK | `200` array de `TriageEntry` |
| Errores | `400` query inválida; `404` sucursal; `401` |
| Evidencia | [`src/triage/dto/list-triage-query.dto.ts`](../src/triage/dto/list-triage-query.dto.ts), [`src/triage/triage.ts`](../src/triage/triage.ts) (`byRiskThenArrival`) |
| Flujos | A5 |

---

### `GET /api/v1/supplies` · `POST /api/v1/supplies` · `PATCH /api/v1/supplies/:id`

**Qué hace:** Inventario global de insumos. Cada insumo tiene `name` único, `stock` y `price` (precio vigente que usa D2). `PATCH` repone stock o cambia el precio.

| | |
|--|--|
| Auth | Bearer. `GET` cualquier rol autenticado; `POST` y `PATCH` solo `admin` |
| Body | `{ "name": "Ibuprofeno 400 mg", "stock": 50, "price": 1200 }` (PATCH parcial) |
| Respuesta OK | `200` / `201` `Supply` |
| Errores | `409` nombre repetido; `404` insumo; `400`; `403`; `401` |
| Evidencia | [`src/supplies/supplies.controller.ts`](../src/supplies/supplies.controller.ts) |
| Flujos | C3, D2 |

---

### `GET /api/v1/beds` · `POST /api/v1/beds`

**Qué hace:** Mapa de camas ordenado por número, y alta de cama (queda `libre`).

| | |
|--|--|
| Auth | Bearer. `GET` cualquier rol autenticado; `POST` solo `admin` |
| Body | `{ "number": "101" }` |
| Respuesta OK | `200` array `Bed` / `201` `Bed` |
| Errores | `409` número repetido; `400`; `403`; `401` |
| Evidencia | [`src/beds/beds.controller.ts`](../src/beds/beds.controller.ts) |
| Flujos | C1, C2 |

---

### `PATCH /api/v1/beds/:id/status`

**Qué hace:** Cambios manuales de estado (C2). Maestranza confirma la limpieza (`en_limpieza` → `libre`). Mantenimiento bloquea (`libre` → `bloqueada`) y desbloquea (`bloqueada` → `libre`). Una cama `ocupada` solo sale con el alta de la internación.

| | |
|--|--|
| Auth | Bearer; roles `admin` o `enfermero` |
| Body | `{ "status": "libre" }` |
| Respuesta OK | `200` `Bed` |
| Errores | `400` transición no permitida («Una cama ocupada solo se libera con el alta del paciente»); `404`; `409` si la cama cambió mientras tanto; `403`; `401` |
| Evidencia | [`src/beds/bed-status.ts`](../src/beds/bed-status.ts), [`src/beds/beds.service.ts`](../src/beds/beds.service.ts) |
| Flujos | C2 |

---

### `POST /api/v1/admissions`

**Qué hace:** Interna a un paciente en una cama `libre` (C1) y genera su protocolo de enfermería según el motivo (B3). La cama pasa a `ocupada` con un update condicional (`WHERE status = 'libre'`): si dos administrativos asignan la misma cama a la vez, solo uno prospera y el otro recibe `409` «La cama acaba de ocuparse».

| | |
|--|--|
| Auth | Bearer; roles `admin` o `secretaria` |
| Body | `{ "patientId": "...", "bedId": "...", "reason": "cirugia" }` |
| Respuesta OK | `201` `Admission` con `protocolTasks` y `admittedAt` |
| Errores | `409` cama no libre, cama recién ocupada o paciente ya internado; `404` paciente o cama; `400`; `403`; `401` |
| Evidencia | [`src/admissions/admissions.service.ts`](../src/admissions/admissions.service.ts), [`src/admissions/protocols.ts`](../src/admissions/protocols.ts) |
| Flujos | C1, B3 |

Protocolos: `cirugia` → ayuno de 8 horas, vía intravenosa periférica, signos cada 2 horas. `respiratorio` → saturación continua, aislamiento de contacto y gotas. `pediatria` → signos cada 4 horas, peso y balance hídrico, acompañante permanente.

---

### `GET /api/v1/admissions` · `GET /api/v1/admissions/:id`

**Qué hace:** Lista las internaciones sin alta, o devuelve una con su `protocolTasks`.

| | |
|--|--|
| Auth | Bearer; cualquier rol autenticado |
| Respuesta OK | `200` |
| Errores | `404` internación; `401` |
| Evidencia | [`src/admissions/admissions.controller.ts`](../src/admissions/admissions.controller.ts) |
| Flujos | B3 |

---

### `POST /api/v1/admissions/:id/discharge`

**Qué hace:** Alta médica: completa `dischargedAt` y la cama pasa a `en_limpieza`, donde no se le puede asignar otro paciente hasta que maestranza la libere.

| | |
|--|--|
| Auth | Bearer; roles `admin` o `secretaria` |
| Respuesta OK | `201` `Admission` |
| Errores | `400` ya tenía alta; `404`; `403`; `401` |
| Evidencia | [`src/admissions/admissions.service.ts`](../src/admissions/admissions.service.ts) |
| Flujos | C2 |

---

### `GET /api/v1/admissions/:id/account`

**Qué hace:** Cuenta de la estadía: las líneas «Insumos de Farmacia» que dejó cada dosis (cada una con su `doseId`, para auditoría) y el total.

| | |
|--|--|
| Auth | Bearer; roles `admin` o `secretaria` |
| Respuesta OK | `200` `{ admissionId, lines: AccountLine[], total }` |
| Errores | `403`; `401` |
| Evidencia | [`src/billing/billing.service.ts`](../src/billing/billing.service.ts) (`stayAccount`) |
| Flujos | D2 |

---

### `POST /api/v1/appointments/:id/charges`

**Qué hace:** Factura la consulta del turno con la cobertura del paciente (D1). Pública: paciente 0 y el Estado el total. Prepaga: el paciente paga su `copay` (nunca más que el precio) y el resto la prepaga. Particular: el paciente paga todo. Una consulta se factura una sola vez.

| | |
|--|--|
| Auth | Bearer; roles `admin` o `secretaria` |
| Body | `{ "price": 15000 }` |
| Respuesta OK | `201` array de `Charge` (`payer`: `paciente`, `estado` o `prepaga`; `amount`) |
| Errores | `409` ya facturada; `404` turno; `400`; `403`; `401` |
| Evidencia | [`src/billing/coverage.ts`](../src/billing/coverage.ts) (`splitByCoverage`), [`src/billing/billing.service.ts`](../src/billing/billing.service.ts) |
| Flujos | D1 |

**Respuesta (prepaga con copago 3000):**

```json
[
  { "id": "...", "appointmentId": "...", "payer": "paciente", "amount": 3000, "createdAt": "..." },
  { "id": "...", "appointmentId": "...", "payer": "prepaga", "amount": 12000, "createdAt": "..." }
]
```
