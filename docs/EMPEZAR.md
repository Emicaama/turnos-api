# Empezar

## Requisitos

- Node.js 22+
- npm
- Docker Desktop (Postgres + stack opcional completo)

## Arranque local (API + Postgres)

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npx prisma db push
npm run seed
npm run start:dev
```

| URL | Uso |
|-----|-----|
| http://localhost:3000/api/v1 | API |
| http://localhost:3000/api/v1/health | Health |
| http://localhost:3000/docs | Swagger |

Postgres del compose sale en el **5433** del host (evita pelear con otro Postgres en 5432).

## Todo en Docker (API + front)

```bash
docker compose up -d --build
```

| URL | Uso |
|-----|-----|
| http://localhost:3001/api/v1 | API (host 3001 → contenedor 3000) |
| http://localhost:3001/docs | Swagger |
| http://localhost:3002 | Front Vue |

Al arrancar, el servicio `api` sincroniza el schema y corre el seed. Para resetear datos: `docker compose down -v` y volver a `up --build`.

## Variables de entorno

Plantilla: [`.env.example`](../.env.example). Validación al boot: [`src/config/env.validation.ts`](../src/config/env.validation.ts).

| Variable | Obligatoria | Default | Qué hace |
|----------|-------------|---------|----------|
| `DATABASE_URL` | sí | — | Postgres de Prisma |
| `JWT_SECRET` | sí | — | Firma del token (mín. 16 caracteres) |
| `JWT_EXPIRES_IN` | no | `8h` | Vida del JWT |
| `CLINIC_TZ` | no | `UTC` en código | Zona para franjas y entreturno |
| `PORT` | no | `3000` | Puerto HTTP |

Compose define `POSTGRES_USER`, `POSTGRES_PASSWORD` y `POSTGRES_DB`; tienen que coincidir con `DATABASE_URL`.

## Cuentas del seed

| Rol | Email | Clave |
|-----|-------|-------|
| admin | `admin@turnos.local` | `Admin123!` |
| secretaría | `secretaria@turnos.local` | `Secretaria123!` |
| enfermero | `enfermero@turnos.local` | `Enfermero123!` |
| médico | `ana.perez@turnos.local` (y otros) | `Medico123!` |

El seed vive en [`seed/`](../seed/) (fuera de Nest). Es idempotente si la secretaría ya existe. Regenerar: `npm run seed:reset`.

## Scripts útiles

| Script | Qué hace |
|--------|----------|
| `npm run start:dev` | Nest en watch |
| `npm run prisma:push` | Sincroniza schema → Postgres |
| `npm run seed` / `seed:reset` | Datos demo |
| `npm test` | Unitarios |
| `npm run test:e2e` | e2e contra `turnos_test` |

## Auth en las llamadas

1. `POST /api/v1/auth/login` con email y password → `accessToken`
2. Header: `Authorization: Bearer <accessToken>`

Detalle de rutas: [API.md](API.md). Recorrido de negocio: [PRODUCTO.md](PRODUCTO.md).
