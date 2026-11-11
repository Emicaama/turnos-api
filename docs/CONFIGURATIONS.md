# Configuraciones

## Impacto en flujos

| Config / variable | Flujos afectados | Efecto |
|-------------------|------------------|--------|
| `DATABASE_URL` | F2–F5 | URI Postgres de Prisma; sin ella el proceso no arranca |
| `JWT_SECRET` | F1–F5 | Firma y validación del Bearer; mínimo 16 caracteres |
| `JWT_EXPIRES_IN` | F1 | `expiresIn` del JWT (default `8h`) |
| `CLINIC_TZ` | F3 | Zona para weekday/hora al validar disponibilidad (default `UTC` si falta) |
| `PORT` | F1–F5 | Puerto HTTP (default `3000`) |
| `POSTGRES_*` (Compose) | F2–F5 | Usuario, clave y DB inicial del contenedor |

## Archivos de configuración

| Archivo | Rol | Flujos |
|---------|-----|--------|
| [`.env.example`](../.env.example) | Plantilla de env local | F1–F5 |
| [`src/config/env.validation.ts`](../src/config/env.validation.ts) | Validación al boot (`ConfigModule`) | F1–F5 |
| [`prisma/schema.prisma`](../prisma/schema.prisma) | Modelos (turnos, lista de espera, bitácora, triaje, signos, indicación, dosis, camas, internaciones, insumos, cargos, cuenta de la estadía) y `env("DATABASE_URL")` | F2–F5, A5, B1–B3, C1–C3, D1, D2 |
| [`docker-compose.yml`](../docker-compose.yml) | Postgres 16, host `5433` → contenedor `5432`, volume `postgres_data`; servicio `api` que compila, sincroniza el schema, siembra y arranca | F2–F5 |
| [`src/app.module.ts`](../src/app.module.ts) | `ConfigModule.forRoot`, guards globales | F1–F5 |
| [`src/auth/auth.module.ts`](../src/auth/auth.module.ts) | `JwtModule.registerAsync` | F1 |
| [`src/main.ts`](../src/main.ts) | Prefijo, ValidationPipe, Swagger, `PORT` | F1–F5 |
| [`package.json`](../package.json) | Scripts, `engines.node >= 22`, Jest | tooling |
| [`test/jest-e2e.json`](../test/jest-e2e.json) | e2e contra Postgres `turnos_test` | F1, F3–F5, B2, C1–C3, D1, D2 |
| [`test/setup-e2e-env.js`](../test/setup-e2e-env.js) | JWT/TZ/PORT de prueba | e2e |
| [`nest-cli.json`](../nest-cli.json) | Compilación Nest | build |
| [`tsconfig.json`](../tsconfig.json) | TS (`nodenext`, decorators) | build |
| [`.prettierrc`](../.prettierrc) | Formato (`singleQuote`, `trailingComma`) | tooling |

Hay un agent en [`.cursor/agents/next-frontend.md`](../.cursor/agents/next-frontend.md). No hay `.cursor/rules` ni skills en este repo.

## Variables de entorno

| Variable | Obligatoria | Flujos | Descripción |
|----------|-------------|--------|-------------|
| `DATABASE_URL` | sí | F2–F5 | Connection string Prisma Postgres. El example usa `postgresql://turnos:turnos_secret@localhost:5433/turnos?schema=public`. |
| `JWT_SECRET` | sí | F1–F5 | Secreto JWT; length menor a 16 aborta el boot. No copiar valores de un `.env` real. |
| `JWT_EXPIRES_IN` | no | F1 | Default `8h` ([`src/auth/auth.module.ts`](../src/auth/auth.module.ts)). |
| `CLINIC_TZ` | no | F3 | IANA TZ; example `America/Argentina/Buenos_Aires`; código default `UTC`. |
| `PORT` | no | F1–F5 | Default `3000`. |

Compose (no son env de Nest): `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` en [`docker-compose.yml`](../docker-compose.yml). Deben coincidir con usuario, clave y base de `DATABASE_URL`.

Prisma lee `DATABASE_URL` del schema; `PrismaService` también inyecta `datasourceUrl` desde ConfigService ([`src/prisma/prisma.service.ts`](../src/prisma/prisma.service.ts)).

## Scripts / flags relevantes

- `npm run start:dev` — `nest start --watch`.
- `npm run prisma:generate` / `postinstall` — cliente Prisma.
- `npm run prisma:push` — `prisma db push` contra el Postgres de `DATABASE_URL`.
- `npm test` — Jest unitario (`rootDir: src`, `*.spec.ts`).
- `npm run test:e2e` — `--forceExit --runInBand`; timeout 120s; [`test/global-setup.js`](../test/global-setup.js) apunta `DATABASE_URL` a `turnos_test` y hace `prisma db push`. El spec vacía esa base antes de sembrar.
- Validación HTTP: `whitelist`, `transform`, `forbidNonWhitelisted` ([`src/main.ts`](../src/main.ts)).

## Rules / skills / agents (si aplica)

El único archivo de Cursor en el repo es [`.cursor/agents/next-frontend.md`](../.cursor/agents/next-frontend.md). No hay rules ni skills.
