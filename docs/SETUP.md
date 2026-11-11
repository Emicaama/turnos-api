# Setup

## Qué es este proyecto

Backend NestJS 11 (`turnos-api`) que persiste en PostgreSQL 16 con Prisma 6. El setup deja la API lista para autenticar, cargar catálogo, operar turnos (F1–F5), clasificar la guardia (A5), registrar signos y medicación (B1, B2), internar en camas (B3, C1, C2), descontar stock (C3) y facturar (D1, D2).

## Flujos que este setup habilita

- F1 — Autenticarse
- F2 — Configurar catálogo clínico
- F3 — Generar y controlar turnos
- F4 — Consultar agenda
- F5 — Leer la bitácora de un turno
- A5 — Triaje de guardia
- B1 y B2 — Signos y medicación sobre un turno
- B3, C1 y C2 — Internación, protocolo y camas
- C3, D1 y D2 — Stock, facturación por cobertura y cuenta de la estadía

## Requisitos

- **Node.js 22+** — `engines.node` en [`package.json`](../package.json); runtime de la API (F1–F5).
- **npm** — scripts del manifiesto.
- **Docker Desktop** (daemon activo) — Postgres vía [`docker-compose.yml`](../docker-compose.yml) (F2–F5 en local).
- **Puerto 5433 libre** — mapeo del host al 5432 del contenedor `postgres` (5432 del host suele estar ocupado por otro Postgres).
- **Puerto 3000 libre** (o `PORT` distinto) — [`src/main.ts`](../src/main.ts). Un segundo `start:dev` falla con `EADDRINUSE` si ya hay un proceso en 3000.

## Instalación

```bash
cp .env.example .env
docker compose up -d
npm install
npx prisma db push
npm run seed
npm run start:dev
```

`npm install` dispara `postinstall` → `prisma generate`. `prisma db push` sincroniza [`prisma/schema.prisma`](../prisma/schema.prisma) con Postgres.

Arranque sin watch: `npm start`. Producción compilada: `npm run build` y `npm run start:prod`.

`npm run seed` ([`src/seed.ts`](../src/seed.ts)) crea el admin `admin@turnos.local` / `Admin123!` si falta, y además inserta la secretaría, el enfermero, cinco médicos, 20 turnos con pacientes distintos, camas en los cuatro estados (101 libre, 204 ocupada, 205 en limpieza, 310 bloqueada), cargos de consulta por las tres coberturas y una cuenta de internación con un insumo. Esa segunda parte es idempotente si `secretaria@turnos.local` ya existe. `POST /api/v1/users` sigue exigiendo JWT de admin.

Las columnas nuevas de `User`, `Specialty`, `Patient`, `Professional` y `Availability` (estado, descripción, contacto, consultorio, modalidad, etc.) tienen default o son opcionales: `npx prisma db push` las agrega sin borrar datos.

## Verificar (smoke de flujos)

| Flujo | Comando / chequeo | OK si |
|-------|-------------------|-------|
| F1 | `POST /api/v1/auth/login` con un `User` existente | `201` y cuerpo con `accessToken` |
| F2 | `GET /api/v1/branches` con Bearer | `200` y array (vacío si no hay catálogo) |
| F3 | `POST /api/v1/appointments` con ids de catálogo y slot dentro de una franja (`CLINIC_TZ`) | `201`, `result: "programado"`, `status: programado` |
| F4 | `GET /api/v1/professionals/:id/agenda?from=&to=` | `200` y array |
| F5 | Tras cancelar: `GET /api/v1/binnacle/:appointmentId` | `200` y nota `Canceló el turno` |
| A5 | `POST /api/v1/triage` con `level: "rojo"` y después `GET /api/v1/triage?branchId=` | `201` en el alta; `200` y el rojo primero en la cola |
| B1 | `POST /api/v1/appointments/:id/vitals` sobre un turno existente | `201` y un `VitalSign` |
| B2, C3 | `POST /api/v1/patients/:id/prescriptions` (profesional) y después `POST /api/v1/appointments/:id/doses` (enfermero) dentro de ±30 minutos | `201` en ambos y `stockRestante` uno menos |
| C1, B3 | `POST /api/v1/admissions` con una cama `libre` | `201`, cama `ocupada`, `protocolTasks` cargado |
| C2 | `POST /api/v1/admissions/:id/discharge` y `PATCH /api/v1/beds/:id/status` `{ "status": "libre" }` | Cama `en_limpieza` y después `libre` |
| D1 | `POST /api/v1/appointments/:id/charges` `{ "price": 15000 }` | `201` y un cargo por pagador |

Reglas sin API: `npm test` (entreturno, transiciones, triaje, fiebre, dosis, protocolos, camas, cobertura, TZ).

Si la base local ya tenía datos de antes de este cambio, `npm run prisma:push` (con `--accept-data-loss`) borra las columnas `Prescription.farmaco` y `DoseAdministration.enHorario`, y no puede agregar `Prescription.supplyId` si quedan indicaciones viejas. En ese caso hay que vaciar esas tablas o recrear el volumen `postgres_data`.

Swagger (exploración, no es un flujo): http://localhost:3000/docs

API: http://localhost:3000/api/v1

## Notas / problemas conocidos

- Sin Docker Desktop, `docker compose up -d` falla al hablar con el engine; la API no conecta a `DATABASE_URL` de `.env.example`.
- `JWT_SECRET` debe tener al menos 16 caracteres o el boot aborta ([`src/config/env.validation.ts`](../src/config/env.validation.ts)).
- `DATABASE_URL` tiene que apuntar a la base `turnos` del compose (`.env.example`).
- `npm run test:e2e` usa la base `turnos_test` del mismo Postgres ([`test/global-setup.js`](../test/global-setup.js)). Hace falta `docker compose up -d`.
- Health: `GET /api/v1/health` ([`src/health/health.controller.ts`](../src/health/health.controller.ts)).
- No hay SMTP ni WhatsApp. El front Vue (`../Front-Hospital/FrontHospitall`) se conecta por el proxy de Vite; si el puerto 3000 está ocupado, levantá la API con otro `PORT` y apuntá `VITE_API_PROXY_TARGET` a ese puerto.
