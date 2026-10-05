# Endpoints

## Resumen

API REST NestJS con prefijo global `api/v1` ([`src/main.ts`](../src/main.ts)). Auth JWT Bearer en todas las rutas salvo las marcadas `@Public()` (solo login). `RolesGuard` global: sin `@Roles` basta estar autenticado; con `@Roles` hace falta ese rol ([`src/app.module.ts`](../src/app.module.ts)). POST Nest responde `201`. Validación: `400` si el body/query no cumple class-validator. Documentación interactiva (no es un recurso de negocio): `GET /docs`.

IDs: campo `id` UUID (Prisma). Roles: `admin` | `secretaria` | `profesional`. Estados de turno: `programado` | `en_sala_de_espera` | `atendido` | `cancelado`.

`GET /api/v1/health` es público y responde `{ "status": "ok", "postgres": true }` si Postgres acepta `SELECT 1` ([`src/health/health.controller.ts`](../src/health/health.controller.ts)).

## Índice

| Método | URL | Qué hace (corto) | Flujos | Evidencia |
|--------|-----|------------------|--------|-----------|
| GET | `/api/v1/health` | Ping de Postgres | — | [`src/health/health.controller.ts`](../src/health/health.controller.ts) |
| POST | `/api/v1/auth/login` | Emite JWT | F1 | [`src/auth/auth.controller.ts`](../src/auth/auth.controller.ts) |
| GET | `/api/v1/users/me` | Devuelve el payload del token | F1 | [`src/users/users.controller.ts`](../src/users/users.controller.ts) |
| GET | `/api/v1/users` | Lista usuarios (sin hash) | F1, F2 | [`src/users/users.controller.ts`](../src/users/users.controller.ts) |
| POST | `/api/v1/users` | Crea usuario | F1, F2 | [`src/users/users.controller.ts`](../src/users/users.controller.ts) |
| GET | `/api/v1/branches` | Lista sucursales | F2 | [`src/branches/branches.controller.ts`](../src/branches/branches.controller.ts) |
| GET | `/api/v1/branches/:id` | Obtiene sucursal | F2 | [`src/branches/branches.controller.ts`](../src/branches/branches.controller.ts) |
| POST | `/api/v1/branches` | Crea sucursal | F2 | [`src/branches/branches.controller.ts`](../src/branches/branches.controller.ts) |
| PATCH | `/api/v1/branches/:id` | Actualiza sucursal | F2 | [`src/branches/branches.controller.ts`](../src/branches/branches.controller.ts) |
| GET | `/api/v1/specialties` | Lista especialidades | F2 | [`src/specialties/specialties.controller.ts`](../src/specialties/specialties.controller.ts) |
| GET | `/api/v1/specialties/:id` | Obtiene especialidad | F2 | [`src/specialties/specialties.controller.ts`](../src/specialties/specialties.controller.ts) |
| POST | `/api/v1/specialties` | Crea especialidad | F2 | [`src/specialties/specialties.controller.ts`](../src/specialties/specialties.controller.ts) |
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
| POST | `/api/v1/appointments` | Programa un turno o encola la lista de espera | F3 | [`src/appointments/appointments.controller.ts`](../src/appointments/appointments.controller.ts) |
| GET | `/api/v1/appointments` | Lista/filtra turnos | F3 | [`src/appointments/appointments.controller.ts`](../src/appointments/appointments.controller.ts) |
| GET | `/api/v1/appointments/:id` | Obtiene un turno | F3 | [`src/appointments/appointments.controller.ts`](../src/appointments/appointments.controller.ts) |
| PATCH | `/api/v1/appointments/:id` | Estado, notas o reprogramación | F3 | [`src/appointments/appointments.controller.ts`](../src/appointments/appointments.controller.ts) |
| POST | `/api/v1/appointments/:id/cancel` | Cancela turno | F3 | [`src/appointments/appointments.controller.ts`](../src/appointments/appointments.controller.ts) |
| GET | `/api/v1/binnacle/:appointmentId` | Bitácora del turno | F5 | [`src/binnacle/binnacle.controller.ts`](../src/binnacle/binnacle.controller.ts) |

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

`email` (`@IsEmail`), `password` string min 8 ([`src/auth/dto/login.dto.ts`](../src/auth/dto/login.dto.ts)). El ejemplo coincide con cuentas del README; el seed que las crearía no está en el árbol.

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

`role` enum `admin` | `secretaria` | `profesional`. `professionalId` opcional, UUID.

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
| Errores | `400` name min 2; `401`; `403`; unicidad Prisma no mapeada a 409 en este servicio (solo `create` directo) |
| Evidencia | [`src/specialties/dto/create-specialty.dto.ts`](../src/specialties/dto/create-specialty.dto.ts) |
| Flujos | F2 |

**Body:**

```json
{ "name": "Cardiología" }
```

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
  "phone": "1112345678"
}
```

`email` y `phone` opcionales.

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

`userId`, `specialtyIds` y `branchIds` opcionales.

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
| Evidencia | [`src/appointments/professionals-agenda.controller.ts`](../src/appointments/professionals-agenda.controller.ts), [`src/appointments/turno/dto/agenda-query.dto.ts`](../src/appointments/turno/dto/agenda-query.dto.ts) |
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

**Qué hace:** Crea franja semanal. Unique compuesto `professionalId + branchId + weekday + startTime` en Prisma.

| | |
|--|--|
| Auth | Bearer; rol `admin` |
| Path params | Sin path params |
| Query | Sin query |
| Body | JSON |
| Respuesta OK | `201` |
| Errores | `400` (weekday 0–6, horas `HH:mm`, slotMinutes ≥ 5); `401`; `403`; unicidad Prisma no mapeada a 409 en este servicio |
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
  "slotMinutes": 30
}
```

---

### `POST /api/v1/appointments`

**Qué hace:** Si el horario está libre, crea un turno `programado`. Si ya hay un turno activo ahí, anota al paciente en la lista de espera del profesional, la sucursal y el día (mismo endpoint). Con `entreturno: true` acorta el turno que cubre un inicio `:15` o `:45`. La escritura va dentro de un lock de Postgres por profesional y sucursal.

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
| Query | Opcionales: `status`, `professionalId`, `branchId`, `from`, `to` (ISO) |
| Body | Sin body |
| Respuesta OK | `200` array Appointment |
| Errores | `400` query inválida; `403` profesional sin `professionalId` en token; `401` |
| Evidencia | [`src/appointments/turno/dto/list-appointments-query.dto.ts`](../src/appointments/turno/dto/list-appointments-query.dto.ts) |
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
| Evidencia | [`src/appointments/turno/dto/update-appointment.dto.ts`](../src/appointments/turno/dto/update-appointment.dto.ts), [`src/appointments/status/status-transitions.ts`](../src/appointments/status/status-transitions.ts) |
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

**Qué hace:** Devuelve las notas de ese turno, de la más vieja a la más nueva.

| | |
|--|--|
| Auth | Bearer; roles `admin` o `secretaria` |
| Path params | `appointmentId` del turno |
| Query | Sin query |
| Body | Sin body |
| Respuesta OK | `200` array de `BinnacleRecord` |
| Errores | `401`; `403` |
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
    "createdAt": "2026-08-18T15:10:00.000Z"
  }
]
```

Cada nota es una frase: `Creó el turno`, `Creó un entreturno`, `Se acortó por un entreturno`, `Anunció al paciente en sala de espera`, `Marcó el turno como atendido`, `Canceló el turno`, `El horario pasó al primero de la lista de espera`, `Asignó el horario liberado desde la lista de espera`, `Reprogramó el turno` o `Creó el turno reprogramado`.
