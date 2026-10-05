# Features

## Resumen

Capacidades de la API alineadas a F1–F5: identidad, catálogo clínico, control de turnos (estados, solape, disponibilidad), agenda y bitácora. Las notificaciones son un puerto que solo registra en log.

## Capacidades por flujo

### F1 — Autenticarse

- **Login JWT** — compara password con bcrypt y firma token — evidencia: [`src/auth/auth.service.ts`](../src/auth/auth.service.ts)
- **Ruta pública de login** — `@Public()` evita el guard JWT — evidencia: [`src/auth/auth.controller.ts`](../src/auth/auth.controller.ts), [`src/common/decorators/public.decorator.ts`](../src/common/decorators/public.decorator.ts)
- **Perfil del token** — `GET /users/me` devuelve el payload — evidencia: [`src/users/users.controller.ts`](../src/users/users.controller.ts)
- **Alta de usuarios (admin)** — email único, hash, rol — evidencia: [`src/users/users.service.ts`](../src/users/users.service.ts)

### F2 — Configurar catálogo clínico

- **Sucursales** — alta/edición admin; listado autenticado — evidencia: [`src/branches/branches.controller.ts`](../src/branches/branches.controller.ts)
- **Especialidades** — alta admin, nombre único en schema — evidencia: [`src/specialties/specialties.controller.ts`](../src/specialties/specialties.controller.ts), [`prisma/schema.prisma`](../prisma/schema.prisma) (`Specialty`)
- **Profesionales** — vínculo a usuario, especialidades y sucursales — evidencia: [`src/professionals/professionals.service.ts`](../src/professionals/professionals.service.ts)
- **Pacientes** — alta/edición secretaría/admin; `documentId` único — evidencia: [`src/patients/patients.service.ts`](../src/patients/patients.service.ts)
- **Disponibilidad semanal** — franjas por profesional, sucursal y weekday — evidencia: [`src/availability/availability.controller.ts`](../src/availability/availability.controller.ts)

### F3 — Generar y controlar turnos

- **Alta programada o lista de espera** — el mismo `POST /appointments`; si el hueco está libre queda `programado`, si ya está tomado encola — evidencia: [`src/appointments/appointments.service.ts`](../src/appointments/appointments.service.ts)
- **Bloqueo de agenda** — `pg_advisory_xact_lock` por profesional y sucursal; la reserva que pierde la carrera responde `409` — evidencia: [`src/appointments/agenda-lock.ts`](../src/appointments/agenda-lock.ts)
- **Entreturno** — `entreturno: true`, solo inicio `:15` o `:45`; acorta el turno que cubre ese instante — evidencia: [`src/appointments/entreturno.ts`](../src/appointments/entreturno.ts)
- **Validación de catálogo** — paciente/profesional/sucursal existentes; profesional en esa sucursal si tiene `branchIds` — evidencia: [`src/appointments/appointments.service.ts`](../src/appointments/appointments.service.ts) (`assertCatalog`)
- **Validación de disponibilidad** — slot dentro de franja en `CLINIC_TZ` — evidencia: [`src/availability/time-in-zone.ts`](../src/availability/time-in-zone.ts), test [`src/availability/time-in-zone.spec.ts`](../src/availability/time-in-zone.spec.ts)
- **Anti-solapamiento** — turnos activos (`programado`/`en_sala_de_espera`) del mismo profesional y sucursal — evidencia: [`src/appointments/appointments.service.ts`](../src/appointments/appointments.service.ts)
- **Máquina de estados** — `programado` → `en_sala_de_espera` → `atendido`, o `cancelado`; reprogramar solo `programado` — evidencia: [`src/appointments/status-transitions.ts`](../src/appointments/status-transitions.ts)
- **Reprogramar** — cancela y crea turno nuevo; el hueco viejo puede promover la lista de espera — evidencia: `reschedule` en [`src/appointments/appointments.service.ts`](../src/appointments/appointments.service.ts)
- **Cancelar** — `POST .../cancel`; el profesional no cancela; promueve al primero de la lista de ese día — evidencia: mismo controller/service
- **Listado filtrado** — status, profesional, sucursal, rango; profesional acotado a los suyos — evidencia: [`src/appointments/dto/list-appointments-query.dto.ts`](../src/appointments/dto/list-appointments-query.dto.ts)
- **Notificación por log** — alta, cancelación, reprogramación, sala de espera y lista de espera — evidencia: [`src/notifications/log-notification.adapter.ts`](../src/notifications/log-notification.adapter.ts)

### F4 — Consultar agenda

- **Agenda por profesional y rango** — excluye `cancelado`; el profesional no ve agendas ajenas — evidencia: [`src/appointments/professionals-agenda.controller.ts`](../src/appointments/professionals-agenda.controller.ts)

### F5 — Leer la bitácora de un turno

- **Bitácora del turno** — `authorName` y una frase (`text`) — evidencia: [`src/binnacle/binnacle.service.ts`](../src/binnacle/binnacle.service.ts), modelo `BinnacleRecord` en [`prisma/schema.prisma`](../prisma/schema.prisma)
- **Consulta restringida** — admin/secretaría, orden cronológico — evidencia: [`src/binnacle/binnacle.controller.ts`](../src/binnacle/binnacle.controller.ts)

## Capacidades transversales

- **Prefijo `api/v1` y ValidationPipe** — whitelist, transform, forbidNonWhitelisted — flujos: F1–F5 — evidencia: [`src/main.ts`](../src/main.ts)
- **JWT global + roles** — `APP_GUARD` Jwt y Roles — flujos: F1–F5 — evidencia: [`src/app.module.ts`](../src/app.module.ts), [`src/common/guards/jwt-auth.guard.ts`](../src/common/guards/jwt-auth.guard.ts)
- **Prisma Client inyectable** — conexión al boot — flujos: F2–F5 — evidencia: [`src/prisma/prisma.service.ts`](../src/prisma/prisma.service.ts)
- **Swagger Bearer** — documentación interactiva — transversal — evidencia: [`src/main.ts`](../src/main.ts)
- **Errores de unicidad Prisma** — mapeo a 409 en usuarios (email) y pacientes (documento) — flujos: F1, F2 — evidencia: [`src/prisma/prisma.errors.ts`](../src/prisma/prisma.errors.ts)

## Fuera de alcance / no confundir

- UI, SMTP, WhatsApp, pagos — declarados fuera de plantilla en [`README.md`](../README.md).
- `LogNotificationAdapter` no envía correo; solo `Logger`.
- Health (`GET /api/v1/health`) hace `SELECT 1` contra Postgres — evidencia: [`src/health/health.controller.ts`](../src/health/health.controller.ts).
- Seed (`npm run seed`) crea secretaría, dos médicos y tres turnos — evidencia: [`src/seed/seed.service.ts`](../src/seed/seed.service.ts).
- ESLint/Prettier/Jest son tooling, no capacidades de producto.
- No hay `.cursor/` ni agents/skills en este repo.
