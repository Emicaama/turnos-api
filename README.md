# Turnos API

API REST para una clínica: **turnos**, **guardia (triaje)**, **internación**, **enfermería** y **facturación**, con roles JWT y PostgreSQL.

- NestJS 11 · Node 22 · Prisma 6 · PostgreSQL 16
- Prefijo: `/api/v1` · Swagger: `/docs`
- Roles: `admin` · `secretaria` · `profesional` · `enfermero`
- Front Vue opcional: `../Front-Hospital/FrontHospitall` (proxy `/api`)

```
Login → catálogo (sedes, médicos, pacientes, franjas)
      → turnos / agenda / bitácora
      → triaje (guardia, sin turno)
      → internación (cama + protocolo)
           ├─ signos (fiebre > 39 °C → WARN guardia)
           ├─ dosis → stock − 1 → cuenta de la estadía
           └─ alta → cama en limpieza
      → facturar consulta
```

Las notificaciones no mandan mail: escriben en la consola de Nest (`warn` para `guardia`, `log` para el resto).

---

## Cómo levantarlo

### Requisitos

Node.js 22+, npm, Docker Desktop.

### Opción A — Todo en Docker (API + front)

```bash
cp .env.example .env
docker compose up -d --build
```

| Servicio | URL |
|----------|-----|
| API | http://localhost:3001/api/v1 |
| Health | http://localhost:3001/api/v1/health |
| Swagger | http://localhost:3001/docs |
| Front | http://localhost:3002 |

El servicio `api` sincroniza el schema y corre el seed al arrancar. Reset de datos: `docker compose down -v` y otra vez `up --build`.

### Opción B — API en el host + Postgres en Docker

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npx prisma db push
npm run seed
npm run start:dev
```

| Servicio | URL |
|----------|-----|
| API | http://localhost:3000/api/v1 |
| Swagger | http://localhost:3000/docs |

Postgres del compose sale en el **5433** del host.

### Variables de entorno

Plantilla: [`.env.example`](.env.example).

| Variable | Obligatoria | Default | Qué hace |
|----------|-------------|---------|----------|
| `DATABASE_URL` | sí | — | Connection string de Prisma |
| `JWT_SECRET` | sí | — | Firma del JWT (mín. 16 caracteres) |
| `JWT_EXPIRES_IN` | no | `8h` | Vida del token |
| `CLINIC_TZ` | no | `UTC` en código | Zona para franjas y entreturno |
| `PORT` | no | `3000` | Puerto HTTP |

### Cuentas del seed

| Rol | Email | Clave |
|-----|-------|-------|
| admin | `admin@turnos.local` | `Admin123!` |
| secretaría | `secretaria@turnos.local` | `Secretaria123!` |
| enfermero | `enfermero@turnos.local` | `Enfermero123!` |
| médico | `ana.perez@turnos.local` (+ otros) | `Medico123!` |

El seed (`seed/`, fuera de Nest) es idempotente si la secretaría ya existe. Regenerar: `npm run seed:reset`.

### Auth en todas las llamadas

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "secretaria@turnos.local", "password": "Secretaria123!" }
```

Respuesta: `{ "accessToken": "..." }`. Después:

```http
Authorization: Bearer <accessToken>
```

### Scripts

| Script | Qué hace |
|--------|----------|
| `npm run start:dev` | Nest en watch |
| `npm run prisma:push` | Schema → Postgres |
| `npm run seed` / `seed:reset` | Datos demo |
| `npm test` | Unitarios |
| `npm run test:e2e` | e2e contra `turnos_test` |

---

## Qué hace (roles)

| Rol | Puede |
|-----|--------|
| **Secretaría** | Turnos, pacientes, triaje, internación/alta, facturar consulta, ver cuentas |
| **Enfermero** | Triaje, signos, dosis, liberar/bloquear camas |
| **Profesional** | Su agenda, indicar medicación, protocolos, marcar `atendido` en turnos propios |
| **Admin** | Catálogo (sedes, especialidades, médicos, camas, insumos, usuarios) + todo lo anterior |

El paciente no usa la API.

### Contratos útiles

| Concepto | Valores |
|----------|---------|
| Estados de turno | `programado` → `en_sala_de_espera` → `atendido` (o `cancelado`) |
| Triaje | `rojo` · `amarillo` · `verde` |
| Cama | `disponible` · `ocupada` · `en_limpieza` · `bloqueada` |
| Cobertura | `publica` · `prepaga` · `particular` |
| Errores | `401` sin token · `403` rol · `400` body · `404` · `409` conflicto |

---

## Historias de usuario → endpoints (ejemplos)

Las 13 historias A–D están cubiertas. Los `id` son UUID; tomalos del seed (`GET` de pacientes, profesionales, sucursales, camas, insumos).

### A1 — Reserva de turno seguro

Hueco libre → turno `programado`. Si dos reservas pelean el mismo hueco en la misma milésima, una puede responder `409`.

```http
POST /api/v1/appointments
Authorization: Bearer <token secretaría>
Content-Type: application/json

{
  "patientId": "<uuid>",
  "professionalId": "<uuid>",
  "branchId": "<uuid>",
  "startAt": "2026-08-17T12:00:00.000Z",
  "endAt": "2026-08-17T12:30:00.000Z",
  "notes": "Control"
}
```

`201` con `result: "programado"`.

### A2 — Entreturno

Mismo endpoint con `entreturno: true`. El inicio, en `CLINIC_TZ`, tiene que ser `:15` o `:45`; acorta el turno que contiene ese instante.

```http
POST /api/v1/appointments

{
  "patientId": "<uuid>",
  "professionalId": "<uuid>",
  "branchId": "<uuid>",
  "startAt": "2026-08-17T12:15:00.000Z",
  "endAt": "2026-08-17T12:30:00.000Z",
  "entreturno": true
}
```

### A3 — Lista de espera

Si el horario ya está ocupado, el mismo `POST /appointments` responde `201` con `result: "lista_de_espera"` (no abre otro turno). Al cancelar, puede promover al primero:

```http
GET  /api/v1/appointments/waitlist
POST /api/v1/appointments/:id/cancel
```

### A4 — Estados de atención

```http
PATCH /api/v1/appointments/:id
{ "status": "en_sala_de_espera" }

PATCH /api/v1/appointments/:id
{ "status": "atendido" }

GET /api/v1/professionals/:id/agenda?from=2026-08-17T00:00:00.000Z&to=2026-08-18T00:00:00.000Z
GET /api/v1/binnacle/:appointmentId
```

### A5 — Triaje de guardia

No crea turno. `rojo` deja un `WARN [guardia]` en el log.

```http
POST /api/v1/triage
{
  "patientId": "<uuid>",
  "branchId": "<uuid>",
  "level": "rojo"
}

GET /api/v1/triage?branchId=<uuid>
```

### B1 — Signos vitales (internación activa)

Temperatura **> 39** → `fueraDeRango: true` + `WARN` a guardia con el número de cama.

```http
POST /api/v1/admissions/:admissionId/vitals
{
  "sistolica": 130,
  "diastolica": 85,
  "frecuenciaCardiaca": 98,
  "temperatura": 39.4,
  "notes": "Fiebre"
}
```

### B2 — Medicación prescrita

```http
POST /api/v1/patients/:patientId/prescriptions
{
  "supplyId": "<uuid>",
  "dosis": "1 comprimido",
  "cadaHoras": 8
}

POST /api/v1/admissions/:admissionId/doses
{
  "indicacionId": "<uuid>",
  "horaIndicada": "2026-08-17T15:00:00.000Z",
  "administradaEn": "2026-08-17T15:05:00.000Z"
}
```

La toma solo entra si `administradaEn` cae a ±30 minutos de `horaIndicada`. Dispara C3 y D2.

### B3 — Protocolos + C1 — Asignar cama

```http
POST /api/v1/protocols
{
  "reason": "respiratorio",
  "tasks": ["Control de signos cada 4 h", "Oxígeno según protocolo"]
}

POST /api/v1/admissions
{
  "patientId": "<uuid>",
  "bedId": "<uuid cama disponible>",
  "reason": "respiratorio",
  "diagnosis": "Neumonía",
  "treatingProfessionalId": "<uuid>"
}
```

Cama `disponible` → `ocupada`. Segunda asignación simultánea → `409`. Sin motivo o sin protocolo, `protocolTasks` queda vacío.

### C2 — Alta y limpieza

```http
POST /api/v1/admissions/:id/discharge

PATCH /api/v1/beds/:id/status
{ "status": "disponible" }
```

El alta deja la cama en `en_limpieza`. Después se libera o se bloquea (`bloqueada`).

### C3 — Stock / D2 — Insumos en la cuenta

Cada dosis exitosa descuenta 1 unidad del insumo (sin stock → `409`) y suma una línea a la cuenta de la estadía:

```http
GET /api/v1/admissions/:admissionId/account
GET /api/v1/supplies
```

### D1 — Facturar consulta por cobertura

```http
POST /api/v1/appointments/:id/charges
{ "price": 15000 }
```

Reparte el monto según la cobertura del paciente (`publica` / `prepaga` / `particular`).

---

## Índice rápido de endpoints

Todas bajo `/api/v1`.

| Método | URL | Historia |
|--------|-----|----------|
| GET | `/health` | — |
| POST | `/auth/login` | — |
| GET | `/users/me` | — |
| CRUD | `/users` · `/branches` · `/specialties` · `/patients` · `/professionals` · `/availability` | catálogo |
| POST/GET/PATCH | `/appointments` · `.../cancel` · `.../waitlist` | A1–A4 |
| GET | `/professionals/:id/agenda` | A4 |
| GET | `/binnacle/:appointmentId` · `/binnacle/admissions/:id` | A4, B1, B2 |
| POST/GET | `/triage` | A5 |
| GET/POST/PATCH | `/beds` · `.../status` | C1, C2 |
| POST/GET | `/admissions` · `.../discharge` · `.../account` | B3, C1, C2, D2 |
| POST | `/admissions/:id/vitals` · `.../doses` | B1, B2, C3, D2 |
| GET/POST | `/patients/:id/prescriptions` | B2 |
| GET/POST | `/protocols` | B3 |
| GET/POST/PATCH | `/supplies` | C3 |
| POST | `/appointments/:id/charges` | D1 |

---

## Más detalle

| Documento | Contenido |
|-----------|-----------|
| [docs/Historias de usuario.md](docs/Historias%20de%20usuario.md) | Texto completo de las historias |
| [docs/FLUJOS.md](docs/FLUJOS.md) | Qué función y archivo corre en cada paso |
| [docs/PRODUCTO.md](docs/PRODUCTO.md) | Resumen de producto |
| [docs/EMPEZAR.md](docs/EMPEZAR.md) | Setup ampliado |
| [docs/API.md](docs/API.md) | Índice de API |
| [docs/Turnos-API-Historias-A-D.postman_collection.json](docs/Turnos-API-Historias-A-D.postman_collection.json) | Colección Postman por historia |

Índice de docs: [docs/README.md](docs/README.md).

**Fuera de alcance:** SMTP real, cobro de pagos, WhatsApp.
