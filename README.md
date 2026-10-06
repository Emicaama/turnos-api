# Turnos API

API NestJS 11 + Node 22 para que una **secretaría** genere y controle turnos de una clínica, con **Prisma + PostgreSQL** en Docker.

## Stack

- NestJS 11 (CommonJS / compilado Nest)
- Prisma 6 (PostgreSQL) — schema en `prisma/schema.prisma`
- TypeScript, npm, Jest, Prettier
- PostgreSQL 16 vía Docker Compose
- JWT + roles: `admin`, `secretaria`, `profesional`
- Swagger en `/docs`

Docs: [Nest + Prisma](https://docs.nestjs.com/recipes/prisma) · [Prisma PostgreSQL](https://www.prisma.io/docs/orm/overview/databases/postgresql) · [Auth](https://docs.nestjs.com/security/authentication) · [imagen postgres](https://hub.docker.com/_/postgres)

## Arranque

```bash
cp .env.example .env
docker compose up -d
npm install
npx prisma db push
npx run migtration
npm run seed
npm run start:dev
```

- API: http://localhost:3000/api/v1
- Health: http://localhost:3000/api/v1/health
- Swagger: http://localhost:3000/docs

Cuentas del seed:

- **secretaria** — `secretaria@turnos.local` / `Secretaria123!`
- **Ana Pérez** — `ana.perez@turnos.local` / `Medico123!`
- **Luis Gómez** — `luis.gomez@turnos.local` / `Medico123!`

El seed también deja la sede central, dos pacientes y tres turnos programados el lunes 2026-10-05 (hora Argentina): Ana 09:00 y 10:00, Luis 11:00. Si la secretaría ya existe, no vuelve a insertar.

Los ids son UUID. Docker Desktop tiene que estar corriendo para `docker compose up -d`. El compose publica Postgres en el puerto **5433** del host para no pisar otro Postgres que use 5432.

## Siempre prendida en Docker

Nest usa Express (`@nestjs/platform-express`). El servicio `api` queda levantado con `restart: unless-stopped`: al iniciar sincroniza el schema y corre el seed.

```bash
docker compose up -d --build
```

- API: http://localhost:3001/api/v1
- Health: http://localhost:3001/api/v1/health
- Swagger: http://localhost:3001/docs

El host usa el puerto **3001** porque el 3000 suele estar ocupado. Dentro del contenedor la API escucha en el 3000.

## Flujo

1. Login secretaría `POST /api/v1/auth/login`
2. Crear turno `POST /api/v1/appointments` (paciente + profesional + sucursal + horario)
3. Listar / filtrar `GET /api/v1/appointments`
4. Agenda `GET /api/v1/professionals/:id/agenda?from=&to=`
5. Cancelar `POST /api/v1/appointments/:id/cancel` (queda en `GET /api/v1/binnacle/:id`)

Reglas: un profesional no puede tener dos turnos activos (`programado`/`en_sala_de_espera`) solapados en la misma sucursal. Si el horario ya está tomado, el mismo POST deja al paciente en la lista de espera. Si dos reservas entran juntas a un hueco libre, la segunda responde 409. El horario debe caer en su disponibilidad. El profesional no crea turnos ajenos. Un entreturno (`entreturno: true`) solo puede empezar a los :15 o :45.

Horarios de disponibilidad se interpretan en `CLINIC_TZ`.

## Scripts

- `npm run start:dev` — Nest watch
- `npm run prisma:push` — migra estados viejos si hace falta y sincroniza el schema con Postgres
- `npm run seed` — datos demo (idempotente si ya existe la secretaría)
- `npm test` — unitarios
- `npm run test:e2e` — programar, lista de espera, entreturno, estados y bitácora (usa la base `turnos_test`)

## Fuera de esta plantilla

UI, SMTP real, pagos, WhatsApp.
