# Features

## Resumen

Capacidades de la API alineadas a F1–F5: identidad, catálogo clínico, control de turnos (estados, solape, disponibilidad), agenda y bitácora. También el triaje de guardia (A5), los signos y la medicación sobre un turno (B1, B2), la internación con protocolo y camas (B3, C1, C2), el stock de insumos (C3) y la facturación (D1, D2). Las notificaciones son un puerto que solo registra en log.

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
- **Reserva concurrente** — la escritura corre en una transacción serializable; si Postgres aborta la carrera, responde `409` — evidencia: [`src/prisma/prisma.service.ts`](../src/prisma/prisma.service.ts) (`runSerializable`), [`src/prisma/prisma.errors.ts`](../src/prisma/prisma.errors.ts) (`isSerializationConflict`)
- **Entreturno** — `entreturno: true`, solo inicio `:15` o `:45`; acorta el turno que cubre ese instante — evidencia: [`src/appointments/appointments.service.ts`](../src/appointments/appointments.service.ts), [`src/appointments/appointment-rules.ts`](../src/appointments/appointment-rules.ts) (`isEntreturnoStart`)
- **Validación de catálogo** — paciente/profesional/sucursal existentes; profesional en esa sucursal si tiene `branchIds` — evidencia: [`src/appointments/appointments.service.ts`](../src/appointments/appointments.service.ts) (`assertCatalogExists`)
- **Validación de disponibilidad** — slot dentro de franja en `CLINIC_TZ` — evidencia: [`src/availability/time-in-zone.ts`](../src/availability/time-in-zone.ts), test [`src/availability/time-in-zone.spec.ts`](../src/availability/time-in-zone.spec.ts)
- **Anti-solapamiento** — turnos activos (`programado`/`en_sala_de_espera`) del mismo profesional y sucursal — evidencia: [`src/appointments/appointments.service.ts`](../src/appointments/appointments.service.ts)
- **Máquina de estados** — `programado` → `en_sala_de_espera` → `atendido`, o `cancelado`; reprogramar solo `programado` — evidencia: [`src/appointments/appointment-rules.ts`](../src/appointments/appointment-rules.ts) (`canTransition`, `canReschedule`)
- **Reprogramar** — cancela y crea turno nuevo; el hueco viejo puede promover la lista de espera — evidencia: `reschedule` en [`src/appointments/appointments.service.ts`](../src/appointments/appointments.service.ts)
- **Cancelar** — `POST .../cancel`; el profesional no cancela; promueve al primero de la lista de ese día — evidencia: mismo controller/service
- **Listado filtrado** — status, profesional, sucursal, rango; profesional acotado a los suyos — evidencia: [`src/appointments/dto/list-appointments-query.dto.ts`](../src/appointments/dto/list-appointments-query.dto.ts)
- **Notificación por log** — alta, cancelación, reprogramación, sala de espera, lista de espera y triaje rojo — evidencia: [`src/notifications/log-notification.adapter.ts`](../src/notifications/log-notification.adapter.ts)

### F4 — Consultar agenda

- **Agenda por profesional y rango** — excluye `cancelado`; el profesional no ve agendas ajenas — evidencia: [`src/appointments/professionals-agenda.controller.ts`](../src/appointments/professionals-agenda.controller.ts)

### F5 — Leer la bitácora de un turno

- **Bitácora del turno** — `authorName`, una frase (`text`) y `kind` (`agenda`, `signos`, `medicacion`) — evidencia: [`src/binnacle/binnacle.service.ts`](../src/binnacle/binnacle.service.ts), modelo `BinnacleRecord` en [`prisma/schema.prisma`](../prisma/schema.prisma)
- **Consulta restringida** — admin/secretaría ven todo; el profesional solo `signos` o `medicacion` de un turno propio — evidencia: [`src/binnacle/binnacle.controller.ts`](../src/binnacle/binnacle.controller.ts)

### A5 — Triaje de guardia

- **Clasificar** — `POST /triage` con paciente, sucursal y nivel `rojo` (riesgo vital), `amarillo` o `verde`. No abre un turno — evidencia: [`src/triage/triage.service.ts`](../src/triage/triage.service.ts)
- **Cola por riesgo** — `GET /triage?branchId=` pone el rojo primero y, a igual nivel, respeta la llegada — evidencia: [`src/triage/triage.ts`](../src/triage/triage.ts) (`byRiskThenArrival`)
- **Aviso a guardia** — solo el rojo escribe `[guardia]` en el log — evidencia: [`src/triage/triage.ts`](../src/triage/triage.ts) (`isVitalRisk`), [`src/notifications/log-notification.adapter.ts`](../src/notifications/log-notification.adapter.ts)

### B1 y B2 — Signos y medicación

- **Signos** — `POST /appointments/:id/vitals`. Fiebre si la temperatura supera 39 °C: nota `signos` y el mismo log `[guardia]` — evidencia: [`src/nursing/nursing.ts`](../src/nursing/nursing.ts) (`isFever`, `vitalNote`)
- **Indicación y dosis** — `POST /patients/:id/prescriptions` (profesional) y `POST /appointments/:id/doses` (enfermero). La toma entra solo a ±30 minutos — evidencia: [`src/nursing/nursing.ts`](../src/nursing/nursing.ts) (`isWithinDoseWindow`)

### B3, C1 y C2 — Internación y camas

- **Asignación segura** — update condicional `libre` → `ocupada`; la segunda asignación simultánea recibe `409` — evidencia: [`src/beds/beds.service.ts`](../src/beds/beds.service.ts) (`occupy`)
- **Protocolo por motivo** — `cirugia`, `respiratorio`, `pediatria` — evidencia: [`src/admissions/protocols.ts`](../src/admissions/protocols.ts) (`buildProtocol`)
- **Alta y limpieza** — el alta deja la cama `en_limpieza`; maestranza la libera; `libre` ↔ `bloqueada` — evidencia: [`src/beds/bed-status.ts`](../src/beds/bed-status.ts) (`canChangeBedStatus`)

### C3, D1 y D2 — Stock y facturación

- **Descuento atómico** — cada dosis resta 1 si `stock > 0`, en la misma transacción — evidencia: [`src/supplies/supplies.service.ts`](../src/supplies/supplies.service.ts) (`takeOneUnit`)
- **Costo por cobertura** — pública, prepaga con copago o particular — evidencia: [`src/billing/coverage.ts`](../src/billing/coverage.ts) (`splitByCoverage`)
- **Cargo a la estadía** — la dosis de un internado agrega «Insumos de Farmacia» con el precio vigente y su `doseId` — evidencia: [`src/billing/billing.service.ts`](../src/billing/billing.service.ts) (`chargeSupplyToActiveStay`)

## Capacidades transversales

- **Prefijo `api/v1` y ValidationPipe** — whitelist, transform, forbidNonWhitelisted — flujos: F1–F5 — evidencia: [`src/main.ts`](../src/main.ts)
- **JWT global + roles** — `APP_GUARD` Jwt y Roles — flujos: F1–F5 — evidencia: [`src/app.module.ts`](../src/app.module.ts), [`src/common/guards/jwt-auth.guard.ts`](../src/common/guards/jwt-auth.guard.ts)
- **Prisma Client inyectable** — conexión al boot — flujos: F2–F5 — evidencia: [`src/prisma/prisma.service.ts`](../src/prisma/prisma.service.ts)
- **Swagger Bearer** — documentación interactiva — transversal — evidencia: [`src/main.ts`](../src/main.ts)
- **Errores de unicidad Prisma** — mapeo a 409 en usuarios (email), pacientes (documento), camas (número) e insumos (nombre) — flujos: F1, F2, C1, C3 — evidencia: [`src/prisma/prisma.errors.ts`](../src/prisma/prisma.errors.ts)

## Fuera de alcance / no confundir

- UI, SMTP, WhatsApp, cobro de pagos — declarados fuera de plantilla en [`README.md`](../README.md).
- `LogNotificationAdapter` no envía correo; solo `Logger`.
- Health (`GET /api/v1/health`) hace `SELECT 1` contra Postgres — evidencia: [`src/health/health.controller.ts`](../src/health/health.controller.ts).
- Seed (`npm run seed`) crea secretaría, enfermero, cinco médicos, 20 turnos, camas en los cuatro estados, cargos por cobertura y una cuenta de internación — evidencia: [`src/seed/seed.service.ts`](../src/seed/seed.service.ts).
- ESLint/Prettier/Jest son tooling, no capacidades de producto.
- Hay un agent en [`.cursor/agents/next-frontend.md`](../.cursor/agents/next-frontend.md). No hay rules ni skills.
