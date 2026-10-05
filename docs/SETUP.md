# Setup

## Qué es este proyecto

Backend NestJS 11 (`turnos-api`) que persiste en PostgreSQL 16 con Prisma 6. El setup deja la API lista para autenticar, cargar catálogo y operar turnos (flujos F1–F5).

## Flujos que este setup habilita

- F1 — Autenticarse
- F2 — Configurar catálogo clínico
- F3 — Generar y controlar turnos
- F4 — Consultar agenda
- F5 — Leer la bitácora de un turno

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

`npm run seed` ([`src/seed.ts`](../src/seed.ts)) inserta la secretaría, dos médicos y tres turnos. Es idempotente si `secretaria@turnos.local` ya existe. `POST /api/v1/users` sigue exigiendo JWT de admin.

## Verificar (smoke de flujos)

| Flujo | Comando / chequeo | OK si |
|-------|-------------------|-------|
| F1 | `POST /api/v1/auth/login` con un `User` existente | `201` y cuerpo con `accessToken` |
| F2 | `GET /api/v1/branches` con Bearer | `200` y array (vacío si no hay catálogo) |
| F3 | `POST /api/v1/appointments` con ids de catálogo y slot dentro de una franja (`CLINIC_TZ`) | `201`, `result: "programado"`, `status: programado` |
| F4 | `GET /api/v1/professionals/:id/agenda?from=&to=` | `200` y array |
| F5 | Tras cancelar: `GET /api/v1/binnacle/:appointmentId` | `200` y nota `Canceló el turno` |

Reglas de F3 sin API: `npm test` (decisión de hueco, entreturno, transiciones, TZ).

Swagger (exploración, no es un flujo): http://localhost:3000/docs

API: http://localhost:3000/api/v1

## Notas / problemas conocidos

- Sin Docker Desktop, `docker compose up -d` falla al hablar con el engine; la API no conecta a `DATABASE_URL` de `.env.example`.
- `JWT_SECRET` debe tener al menos 16 caracteres o el boot aborta ([`src/config/env.validation.ts`](../src/config/env.validation.ts)).
- `DATABASE_URL` tiene que apuntar a la base `turnos` del compose (`.env.example`).
- `npm run test:e2e` usa la base `turnos_test` del mismo Postgres ([`test/global-setup.js`](../test/global-setup.js)). Hace falta `docker compose up -d`.
- Health: `GET /api/v1/health` ([`src/health/health.controller.ts`](../src/health/health.controller.ts)).
- No hay frontend, SMTP ni WhatsApp ([`README.md`](../README.md)).
