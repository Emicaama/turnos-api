# Turnos API

Plantilla NestJS 11 + Node 22 para que una **secretaría** genere y controle turnos de una clínica, con **Prisma + MongoDB** en Docker.

## Stack

- NestJS 11 (CommonJS / compilado Nest)
- Prisma 6 (MongoDB) — schema en `prisma/schema.prisma`
- TypeScript, npm, Jest, Prettier
- MongoDB 7 vía Docker Compose
- JWT + roles: `admin`, `secretaria`, `profesional`
- Swagger en `/docs`

Docs: [Nest + Prisma](https://docs.nestjs.com/recipes/prisma) · [Prisma MongoDB](https://www.prisma.io/docs/orm/overview/databases/mongodb) · [Auth](https://docs.nestjs.com/security/authentication) · [imagen mongo](https://hub.docker.com/_/mongo)

## Arranque

```bash
cp .env.example .env
docker compose up -d
npm install
npx prisma db push
npm run seed
npm run start:dev
```

- API: http://localhost:3000/api/v1
- Health: http://localhost:3000/api/v1/health
- Swagger: http://localhost:3000/docs

Cuentas del seed:

- **admin** — `admin@turnos.local` / `Admin123!`
- **secretaria** — `secretaria@turnos.local` / `Secretaria123!`
- **profesional** — `profesional@turnos.local` / `Profesional123!`

Docker Desktop tiene que estar corriendo para `docker compose up -d`. Si el daemon no está, `npm run test:e2e` cubre el flujo con Mongo replica set en memoria.

`DATABASE_URL` usa `directConnection=true` para un Mongo de un nodo.

## Flujo

1. Login secretaría `POST /api/v1/auth/login`
2. Crear turno `POST /api/v1/appointments` (paciente + profesional + sucursal + horario)
3. Listar / filtrar `GET /api/v1/appointments`
4. Agenda `GET /api/v1/professionals/:id/agenda?from=&to=`
5. Cancelar `POST /api/v1/appointments/:id/cancel` (queda en `GET /api/v1/audit/appointments/:id`)

Los documentos usan `id` (Prisma), no `_id`.

Reglas: un profesional no puede tener dos turnos activos (`pendiente`/`confirmado`) solapados en la misma sucursal (409). El horario debe caer en su disponibilidad. El profesional no crea turnos ajenos.

Horarios de disponibilidad se interpretan en `CLINIC_TZ`.

## Scripts

- `npm run start:dev` — Nest watch
- `npm run prisma:push` — sincroniza el schema con Mongo
- `npm run seed` — datos demo (idempotente si ya existe el admin)
- `npm test` — unitarios
- `npm run test:e2e` — secretaría crea, solapamiento 409, profesional 403, auditoría al cancelar

## Fuera de esta plantilla

UI, SMTP real, pagos, WhatsApp.
