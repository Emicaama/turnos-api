# Qué hace la aplicación

## En una frase

API REST para que una secretaría de clínica genere y controle turnos de pacientes con profesionales, con roles JWT, disponibilidad, anti-solapamiento y bitácora.

## Tipo de artefacto

API HTTP (plantilla de backend NestJS sobre Express) — evidencia: [`src/main.ts`](../src/main.ts), [`package.json`](../package.json) (`turnos-api`), [`README.md`](../README.md).

No hay UI. Swagger queda en `/docs` (fuera del prefijo `api/v1`). Postgres y, si se usa el servicio `api` del compose, el proceso HTTP viven en Docker ([`docker-compose.yml`](../docker-compose.yml)).

## Para quién

- **Secretaría**: crea, reprograma y cancela turnos; mantiene pacientes.
- **Admin**: configura sucursales, especialidades, profesionales, disponibilidad y usuarios. También opera turnos.
- **Profesional**: consulta su agenda y marca `atendido` un turno propio que ya está en sala de espera. No crea, no cancela y no reprograma.

El paciente no entra a la API. Queda como registro que carga la secretaría o el admin.

## Problema que resuelve

Centralizar la agenda clínica para que un intermediario (secretaría) asigne horarios sin solapar turnos activos del mismo profesional en la misma sucursal, y anotar en la bitácora cada alta, cambio de estado y cancelación.

## Mapa de flujos (fuente de verdad)

| ID | Flujo | Actor | Trigger | Resultado | Evidencia |
|----|-------|-------|---------|-----------|-----------|
| F1 | Autenticarse | Usuario con cuenta (`admin`, `secretaria`, `profesional`) | `POST /api/v1/auth/login` | JWT `accessToken`, o `401` si el email o la clave no coinciden | [`src/auth/auth.controller.ts`](../src/auth/auth.controller.ts), [`src/auth/auth.service.ts`](../src/auth/auth.service.ts) |
| F2 | Configurar catálogo clínico | Admin (sucursales, especialidades, profesionales, disponibilidad, usuarios); secretaría o admin (pacientes) | CRUD bajo `/api/v1/branches`, `/specialties`, `/professionals`, `/availability`, `/patients`, `/users` | Catálogo listo para agendar, o `403` si el rol no escribe ese recurso | controllers en `src/branches/`, `src/specialties/`, `src/professionals/`, `src/availability/`, `src/patients/`, `src/users/` |
| F3 | Generar y controlar turnos | Secretaría o admin (alta, reprogramación y cancelación); profesional (cambio de estado propio) | `POST/GET/PATCH /api/v1/appointments`, `POST .../cancel` | Turno en un estado válido, o `400` / `403` / `404` / `409` | [`src/appointments/appointments.controller.ts`](../src/appointments/appointments.controller.ts), [`src/appointments/appointments.service.ts`](../src/appointments/appointments.service.ts), [`src/appointments/status-transitions.ts`](../src/appointments/status-transitions.ts) |
| F4 | Consultar agenda | Secretaría, admin o el profesional dueño | `GET /api/v1/professionals/:id/agenda?from=&to=` | Turnos no cancelados en el rango, o `403` si un profesional pide la agenda de otro | [`src/appointments/professionals-agenda.controller.ts`](../src/appointments/professionals-agenda.controller.ts) |
| F5 | Leer la bitácora de un turno | Admin o secretaría | `GET /api/v1/binnacle/:appointmentId` | Notas en orden cronológico (`Creó el turno`, `Cambió el estado a …`, `Canceló el turno`, `Reprogramó el turno`), o `403` si el rol es profesional | [`src/binnacle/binnacle.controller.ts`](../src/binnacle/binnacle.controller.ts) |

## Cómo encajan los flujos

Orden típico: **F1** → **F2** → **F3** → **F4** y **F5**.

F1 es obligatorio en toda ruta salvo el login y el health. F3 exige paciente, profesional, sucursal y una franja de disponibilidad (F2). F4 lee lo que dejó F3, sin los cancelados. F5 lee las frases que F3 anota al crear, cambiar estado, reprogramar o cancelar.

En local, el seed ([`src/seed.ts`](../src/seed.ts), [`src/seed/seed.service.ts`](../src/seed/seed.service.ts)) deja hecho un F2 mínimo y tres turnos de F3: secretaría, Ana Pérez, Luis Gómez, sede central, especialidad Clínica médica, dos pacientes y disponibilidad de lunes a viernes 09:00–13:00. Si `secretaria@turnos.local` ya existe, no vuelve a insertar. Con eso se puede entrar directo a F1 y seguir el turno, sin crear el catálogo a mano. `POST /api/v1/users` sigue exigiendo JWT de admin.

`GET /api/v1/health` ([`src/health/health.controller.ts`](../src/health/health.controller.ts)) no es un flujo de negocio: responde `{ "status": "ok", "postgres": true }` si Postgres acepta `SELECT 1`.

### Del arranque al cierre de un turno

El caso integrado es el de la secretaría, que es el actor para el que existe la API. El profesional aparece en los desvíos.

1. **Proceso arriba.** `src/main.ts` escucha en `PORT` (en el contenedor, 3000; en el host del compose, 3001). El prefijo es `api/v1`. Sin `DATABASE_URL` o con `JWT_SECRET` de menos de 16 caracteres el proceso no arranca ([`src/config/env.validation.ts`](../src/config/env.validation.ts)). En Docker el contenedor `api` sincroniza el schema, corre el seed y queda con `restart: unless-stopped`.

2. **F1 — Login.** `POST /api/v1/auth/login` con email y contraseña (mínimo 8 caracteres).
   - `201` y `{ "accessToken" }`. El token lleva `id`, `email`, `name`, `role` y, si el usuario es médico, `professionalId`.
   - `401` si el email no existe o la clave no coincide. El mensaje es el mismo en ambos casos.
   - `400` si el body no cumple el DTO.
   - El resto de llamadas llevan `Authorization: Bearer <accessToken>`. Sin token, `401`.

3. **F2 — Catálogo, si el seed no alcanza.** Lectura de sucursales, especialidades, profesionales, disponibilidad y pacientes: cualquier rol autenticado. Escritura:
   - Sucursal, especialidad, profesional, disponibilidad y usuario: solo admin. Secretaría recibe `403`.
   - Paciente: admin o secretaría. `documentId` duplicado → `409`.
   - Especialidad con nombre ya usado → error de unicidad de Prisma (no está mapeado a `409` en ese servicio).

4. **F3 — Alta del turno.** `POST /api/v1/appointments` con `patientId`, `professionalId`, `branchId`, `startAt`, `endAt` (ISO) y `notes` opcional. Solo admin o secretaría. El servicio, en este orden:
   - Rechaza al profesional (`403`), también cubierto por `@Roles` en el controller.
   - `endAt` tiene que ser posterior a `startAt` (`400` si no).
   - Paciente, profesional y sucursal tienen que existir (`404` si falta uno).
   - Si el profesional tiene `branchIds` y la sucursal no está, `400` («no atiende en esa sucursal»).
   - El intervalo, interpretado en `CLINIC_TZ` (example: `America/Argentina/Buenos_Aires`), tiene que caer el mismo día dentro de una franja de ese profesional y sucursal (`400` si no).
   - El alta corre con un lock de Postgres por profesional y sucursal. Si el hueco sigue libre: `201`, `result: "programado"`, estado `programado`, nota `Creó el turno` y un log `[created]`.
   - Si ese horario ya estaba ocupado: `201`, `result: "lista_de_espera"` (mismo endpoint, sin turno nuevo).
   - Si dos pedidos entran juntos a un hueco que ambos vieron libre, solo el primero programa; el segundo es `409` («El turno acaba de ser ocupado»).
   - `entreturno: true` solo si el inicio es `:15` o `:45` en `CLINIC_TZ`. Acorta el turno que contiene ese instante (`acortado: true`) y crea el tramo siguiente con `entreturno: true`.
   - No hay SMTP; el aviso es un log ([`src/notifications/log-notification.adapter.ts`](../src/notifications/log-notification.adapter.ts)).

5. **F4 — Ver la agenda.** `GET /api/v1/professionals/:id/agenda?from=&to=` devuelve `200` con los turnos de ese profesional en el rango cuyo estado no es `cancelado`, ordenados por inicio. Un profesional que pide otro id recibe `403`. Si el profesional no existe, `404`.

6. **F3 — Vida del turno.** `PATCH /api/v1/appointments/:id`.
   - Solo `notes`: actualiza la nota y no escribe bitácora.
   - `status`: solo transiciones permitidas ([`src/appointments/status-transitions.ts`](../src/appointments/status-transitions.ts)).
     - `programado` → `en_sala_de_espera` o `cancelado`.
     - `en_sala_de_espera` → `atendido` o `cancelado`.
     - `atendido` y `cancelado` no salen a ningún estado (`400`). Un cancelado responde «Un turno cancelado no avanza».
   - El profesional solo puede pasar a `atendido`, y solo sobre sus turnos. Otro profesional que consulta el id recibe `403`. Cancelar por PATCH no está en su lista (`403`).
   - Secretaría o admin pueden esas transiciones y también cancelar. Pasar a sala de espera deja el log «Paciente en sala de espera. Avisar al consultorio.»
   - Cada cambio de estado anota una frase (`Anunció al paciente en sala de espera`, `Marcó el turno como atendido` o `Canceló el turno`), con el nombre de quien lo hizo.
   - Reprogramar (`startAt` y/o `endAt`): solo secretaría o admin, y solo si el turno está `programado`. En el turno viejo anota `Reprogramó el turno` y crea uno nuevo con `Creó el turno reprogramado`. El hueco viejo, si queda libre, se ofrece al primero de la lista de espera. El profesional recibe `403`. Un turno ya cerrado recibe `400`.

7. **F3 — Cancelar.** `POST /api/v1/appointments/:id/cancel`, solo admin o secretaría. Desde `programado` o `en_sala_de_espera` pasa a `cancelado` (`201` en Nest para POST). Desde un estado final, `400`. Anota `Canceló el turno`. Si hay alguien en la lista de espera de ese profesional, sucursal y día, el primero queda `programado` en el hueco y la respuesta incluye `promoted`.

8. **F5 — Bitácora.** `GET /api/v1/binnacle/:appointmentId` como admin o secretaría devuelve `200` y las notas de ese turno, de la más vieja a la más nueva. Cada nota tiene `authorName`, `text` y `createdAt`. El profesional recibe `403`. Un cambio que solo tocó `notes` no aparece acá.

El listado `GET /api/v1/appointments` acompaña F3 y F4: la secretaría filtra por estado, profesional, sucursal y rango; el profesional solo ve los suyos. Si su usuario no tiene `professionalId`, `403`.

## Piezas principales

| Pieza | Flujos | Rol | Evidencia |
|-------|--------|-----|-----------|
| Prefijo HTTP `api/v1` + ValidationPipe | F1–F5 | Contrato de API | [`src/main.ts`](../src/main.ts), [`src/setup-app.ts`](../src/setup-app.ts) |
| JWT + `RolesGuard` | F1–F5 | Autenticación y autorización | [`src/common/guards/`](../src/common/guards/), [`src/app.module.ts`](../src/app.module.ts) |
| Prisma / Postgres | F2–F5 | Persistencia; ids UUID | [`prisma/schema.prisma`](../prisma/schema.prisma), [`src/prisma/`](../src/prisma/) |
| Módulo turnos | F3, F4 | Estados, solape, disponibilidad, reprogramación | [`src/appointments/`](../src/appointments/) |
| Notificaciones (log) | F3 | Puerto sin SMTP | [`src/notifications/`](../src/notifications/) |
| Seed | F1–F3 | Secretaría, dos médicos y tres turnos de demo | [`src/seed/seed.service.ts`](../src/seed/seed.service.ts) |
| Docker Postgres + API | persistencia y proceso HTTP | Motor y servidor con reinicio | [`docker-compose.yml`](../docker-compose.yml), [`Dockerfile`](../Dockerfile) |
| Swagger | — | Exploración interactiva | [`src/setup-app.ts`](../src/setup-app.ts) (`/docs`) |
