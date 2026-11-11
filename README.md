# Turnos API

API NestJS 11 + Node 22 para que una **secretaría** genere y controle turnos de una clínica, con **Prisma + PostgreSQL** en Docker.

## Stack

- NestJS 11 (CommonJS / compilado Nest)
- Prisma 6 (PostgreSQL) — schema en `prisma/schema.prisma`
- TypeScript, npm, Jest, Prettier
- PostgreSQL 16 vía Docker Compose
- JWT + roles: `admin`, `secretaria`, `profesional`, `enfermero`
- Swagger en `/docs`

Docs: [Nest + Prisma](https://docs.nestjs.com/recipes/prisma) · [Prisma PostgreSQL](https://www.prisma.io/docs/orm/overview/databases/postgresql) · [Auth](https://docs.nestjs.com/security/authentication) · [imagen postgres](https://hub.docker.com/_/postgres)

## Arranque

```bash
cp .env.example .env
docker compose up -d
npm install
npx prisma db push
npx run migration
npm run seed
npm run start:dev
```

- API: http://localhost:3000/api/v1
- Health: http://localhost:3000/api/v1/health
- Swagger: http://localhost:3000/docs

Cuentas del seed:

- **admin** — `admin@turnos.local` / `Admin123!` (se crea aunque el resto del seed ya exista)
- **secretaria** — `secretaria@turnos.local` / `Secretaria123!`
- **enfermero** (Martín Torres) — `enfermero@turnos.local` / `Enfermero123!`
- **Ana Pérez** — `ana.perez@turnos.local` / `Medico123!`
- **Luis Gómez** — `luis.gomez@turnos.local` / `Medico123!`
- **Carla Ruiz** — `carla.ruiz@turnos.local` / `Medico123!`
- **Diego Fernández** — `diego.fernandez@turnos.local` / `Medico123!`
- **Elena Soto** — `elena.soto@turnos.local` / `Medico123!`

El seed también deja la sede central, tres especialidades (Clínica médica, Cardiología, Pediatría) y 20 turnos con pacientes distintos entre el lunes 9 y el viernes 13 de noviembre de 2026, repartidos entre los cinco médicos. Tres de esas consultas ya están facturadas, una por cobertura: particular (el paciente paga $15000), pública (el Estado paga $15000) y prepaga (el paciente paga el copago de $3000 y la prepaga el resto). Gael Torres está internado en la cama 204 por cirugía, con el protocolo cargado y una cuenta de internación de $800 por suero fisiológico. La cama 205 quedó en limpieza después del alta de Carlos Yepez y la 310 está bloqueada por mantenimiento. La cama 101 sigue libre. El Ibuprofeno 400 mg queda con 50 unidades a $1200. Si la secretaría ya existe, no vuelve a insertar.

El front Vue de `../Front-Hospital/FrontHospitall` consume esta API a través del proxy de Vite (`/api` → `VITE_API_PROXY_TARGET`, por defecto `http://localhost:3000`); la API no habilita CORS.

Los ids son UUID. Docker Desktop tiene que estar corriendo para `docker compose up -d`. El compose publica Postgres en el puerto **5433** del host para no pisar otro Postgres que use 5432.

## Siempre prendida en Docker

Nest usa Express (`@nestjs/platform-express`). El servicio `api` queda levantado con `restart: unless-stopped`: al iniciar sincroniza el schema y corre el seed.

```bash
docker compose up -d --build
```

- API: http://localhost:3001/api/v1
- Health: http://localhost:3001/api/v1/health
- Swagger: http://localhost:3001/docs

El host usa el puerto **3001** porque el 3000 suele estar ocupado. Dentro del contenedor la API escucha en el 3000. El compose también levanta el front Vue de `../Front-Hospital/FrontHospitall` en http://localhost:3002: nginx sirve el build y reenvía `/api` al servicio `api`.

Para resetear la base y volver a sembrar: `docker compose down -v` y después `docker compose up -d --build` (el servicio `api` sincroniza el schema y corre el seed al arrancar).

## Flujo

1. Login secretaría `POST /api/v1/auth/login`
2. Crear turno `POST /api/v1/appointments` (paciente + profesional + sucursal + horario)
3. Listar / filtrar `GET /api/v1/appointments`
4. Agenda `GET /api/v1/professionals/:id/agenda?from=&to=`
5. Cancelar `POST /api/v1/appointments/:id/cancel` (queda en `GET /api/v1/binnacle/:id`)
6. Triaje `POST /api/v1/triage` (`rojo`, `amarillo` o `verde`). La cola de la sucursal es `GET /api/v1/triage?branchId=`
7. Signos `POST /api/v1/appointments/:id/vitals` (enfermero). Indicación `POST /api/v1/patients/:id/prescriptions` (profesional) y toma `POST /api/v1/appointments/:id/doses` (enfermero, solo a ±30 minutos; descuenta stock)
8. Internación `POST /api/v1/admissions` (cama libre + motivo → protocolo), alta `POST /api/v1/admissions/:id/discharge` (cama a limpieza) y `PATCH /api/v1/beds/:id/status` para liberarla
9. Facturación `POST /api/v1/appointments/:id/charges` según la cobertura del paciente y cuenta de la estadía `GET /api/v1/admissions/:id/account`

Reglas: un profesional no puede tener dos turnos activos (`programado`/`en_sala_de_espera`) solapados en la misma sucursal. Si el horario ya está tomado, el mismo POST deja al paciente en la lista de espera. Si dos reservas entran juntas a un hueco libre, la segunda responde 409. El horario debe caer en su disponibilidad. El profesional no crea turnos ajenos. Un entreturno (`entreturno: true`) solo puede empezar a los :15 o :45. En la guardia, `rojo` va antes que `amarillo` y `verde`. Una cama solo se asigna si está `libre`; dos asignaciones simultáneas dejan una sola (la otra, 409).

Horarios de disponibilidad se interpretan en `CLINIC_TZ`.

## Scripts

- `npm run start:dev` — Nest watch
- `npm run prisma:push` — migra estados viejos si hace falta y sincroniza el schema con Postgres
- `npm run seed` — datos demo (idempotente si ya existe la secretaría)
- `npm test` — unitarios (entreturno, estados, triaje, fiebre, dosis, protocolos, camas, cobertura, zona horaria)
- `npm run test:e2e` — turnos, lista de espera, entreturno, estados, bitácora, internación, stock y facturación (usa la base `turnos_test`)

## Fuera de esta plantilla

UI, SMTP real, cobro de pagos, WhatsApp.
