# Flujos con funciones

> Mismo mapa que [FEATURES.md](FEATURES.md) y [ENDPOINTS.md](ENDPOINTS.md), con la función
> que corre en cada paso. `→` = llama a. Entre `[ ]`, el archivo desde `src/`.
> Sistemas externos en MAYÚSCULAS. Acá el único es el LOG de Nest: no hay mail.
> Prefijo de todas las rutas: `api/v1` (`setup-app.ts`).

```
                         pedido a /api/v1
                                │
              ┌─────────────────┼──────────────────┐
              ▼                 ▼                  ▼
        login / health     catálogo           atención
        (§1, §3)           (§4–§8)        ┌───────┴────────┐
                                          ▼                ▼
                                     turno (§9)      internación (§22)
                                          │                │
                         programado / espera /        cama libre → ocupada
                         entreturno                   alta → en_limpieza
                                          │
                         programado → sala → atendido
                                    └→ cancelado → lista de espera
                                          │
                              signos, dosis, cargo (§17–§21, §24)
```

---

## 0. Puerta (la pasan todos; login y salud salen por `@Public`)

```
pedido
  [setup-app.ts]
   │  ValidationPipe whitelist + forbidNonWhitelisted ── sobra un campo ──► 400
   │  (el pipe corre después del guard)
   ▼
JwtAuthGuard.canActivate                         [common/guards/jwt-auth.guard.ts]
   ├─ @Public ──► sigue
   └─ si no: passport-jwt Bearer                 [auth/jwt.strategy.ts]
         validate copia id, email, name, role, professionalId
         sin token o token malo ──► 401
   ▼
RolesGuard.canActivate                           [common/guards/roles.guard.ts]
   ├─ sin @Roles ──► cualquier rol logueado
   └─ rol fuera de la lista ──► 403
```

El guard de roles está dos veces (global en `app.module.ts` y `@UseGuards` en varios
controllers). Las dos leen el mismo `@Roles`.

---

## 1. Login — `POST /api/v1/auth/login`

Entra por §0, pero `@Public` saltea el 401.

```
POST /api/v1/auth/login
  [auth/auth.controller.ts]
   ▼
login(dto)                                        [auth/auth.service.ts]
   ├─ findByEmail(email en minúsculas)            [users/users.service.ts]
   │     no está ──► 401 Credenciales inválidas
   ├─ bcrypt.compare
   │     no coincide ──► 401 Credenciales inválidas   (el mismo texto)
   └─ jwt.signAsync({ id, email, name, role, professionalId })
                                              ──► 200 { accessToken }
```

No mira si el usuario está activo: no existe ese estado.

---

## 2. Usuarios

### 2a. Quién soy — `GET /api/v1/users/me`

```
GET /api/v1/users/me
  [users/users.controller.ts]
   │  §0, sin @Roles
   ▼
devuelve el payload del token                 (no lee la base)
                                              ──► 200 AuthUser
```

Si el usuario cambió después del login, este endpoint no se entera.

### 2b. Listado — `GET /api/v1/users`

```
GET /api/v1/users
  [users/users.controller.ts]
   │  §0 ── no es admin ──► 403
   ▼
list()                                            [users/users.service.ts]
   └─ user.findMany  omit passwordHash
                                              ──► 200
```

### 2c. Alta — `POST /api/v1/users`

```
POST /api/v1/users
  [users/users.controller.ts]
   │  §0 ── no es admin ──► 403
   ▼
create(dto)                                       [users/users.service.ts]
   ├─ bcrypt.hash(password, 10)
   └─ user.create  email en minúsculas, sin devolver passwordHash
         email repetido (P2002) ──► 409 El email ya está registrado
         professionalId no se valida: no hay FK
                                              ──► 201
```

---

## 3. Salud — `GET /api/v1/health`

Entra por §0, pero `@Public` saltea el 401.

```
GET /api/v1/health
  [health/health.controller.ts]
   └─ prisma.$queryRaw SELECT 1
         falla Postgres ──► el error sigue de largo (no hay { postgres: false })
                                              ──► 200 { status: 'ok', postgres: true }
```

---

## 4. Sucursales

```
GET /api/v1/branches
  [branches/branches.controller.ts]
   │  §0, sin @Roles
   └─ list() orden por nombre                     [branches/branches.service.ts]
                                              ──► 200

GET /api/v1/branches/:id
   └─ findById ── no está ──► 404 Sucursal no encontrada
                                              ──► 200

POST /api/v1/branches
   │  §0 ── no es admin ──► 403
   └─ branch.create                               ──► 201

PATCH /api/v1/branches/:id
   │  §0 ── no es admin ──► 403
   ├─ findById ── no está ──► 404
   └─ branch.update                               ──► 200
```

---

## 5. Especialidades

```
GET /api/v1/specialties
  [specialties/specialties.controller.ts]
   │  §0, sin @Roles
   └─ list() orden por nombre                     [specialties/specialties.service.ts]
                                              ──► 200

GET /api/v1/specialties/:id
   └─ findById ── no está ──► 404 Especialidad no encontrada
                                              ──► 200

POST /api/v1/specialties
   │  §0 ── no es admin ──► 403
   └─ specialty.create
         nombre repetido: el unique del schema no se traduce (P2002 sigue de largo)
                                              ──► 201
```

No hay edición ni baja.

---

## 6. Pacientes

```
GET /api/v1/patients
  [patients/patients.controller.ts]
   │  §0, sin @Roles
   └─ list() apellido, nombre                     [patients/patients.service.ts]
                                              ──► 200

GET /api/v1/patients/:id
   └─ findById ── no está ──► 404 Paciente no encontrado
                                              ──► 200

POST /api/v1/patients
   │  §0 ── no es admin ni secretaría ──► 403
   └─ patient.create
         documentId repetido (P2002) ──► 409 Ya existe un paciente con ese documento
                                              ──► 201

PATCH /api/v1/patients/:id
   │  §0 ── no es admin ni secretaría ──► 403
   ├─ findById ── no está ──► 404
   └─ patient.update
         documentId repetido: P2002 sin traducir
                                              ──► 200
```

`coverage` default `particular`, `copay` default 0. Eso lo usa el cargo (§24).

---

## 7. Profesionales

```
GET /api/v1/professionals
  [professionals/professionals.controller.ts]
   │  §0, sin @Roles
   └─ list() por apellido                         [professionals/professionals.service.ts]
                                              ──► 200

GET /api/v1/professionals/:id
   └─ findById ── no está ──► 404 Profesional no encontrado
                                              ──► 200

POST /api/v1/professionals
   │  §0 ── no es admin ──► 403
   ├─ professional.create  specialtyIds y branchIds default []
   └─ si viene userId → linkProfessional          [users/users.service.ts]
         userId inexistente: P2025 sin traducir (el profesional ya quedó creado)
                                              ──► 201

PATCH /api/v1/professionals/:id
   │  §0 ── no es admin ──► 403
   ├─ findById ── no está ──► 404
   └─ professional.update
         no llama a linkProfessional (cambiar userId no toca User.professionalId)
                                              ──► 200
```

`branchIds` vacío significa “atiende en cualquier sucursal” cuando se saca un turno (§9).

La agenda no está en este controller: es §12.

---

## 8. Disponibilidad

```
GET /api/v1/availability?professionalId=
  [availability/availability.controller.ts]
   │  §0, sin @Roles
   └─ list()  filtra si vino professionalId       [availability/availability.service.ts]
                                              ──► 200

POST /api/v1/availability
   │  §0 ── no es admin ──► 403
   └─ availability.create
         misma franja (profesional + sucursal + weekday + startTime):
         unique del schema, P2002 sin traducir
                                              ──► 201
```

`coversSlot` no tiene ruta propia. Lo llama el alta y la reprogramación:

```
coversSlot(profesional, sucursal, rango, CLINIC_TZ o UTC)   [availability/availability.service.ts]
   ├─ weekdayAndHm(inicio) y weekdayAndHm(fin)    [availability/time-in-zone.ts]
   │     días distintos ──► false
   └─ franjas de ese weekday
         alguna con inicio >= desde y fin <= hasta ──► true
         ninguna ──► false
```

---

## 9. Alta de turno — `POST /api/v1/appointments`

Admin y secretaría. El profesional no crea, ni por el rol ni por el service.

### 9a. Validación común

```
POST /api/v1/appointments
  [appointments/appointments.controller.ts]
   │  §0 ── no es admin ni secretaría ──► 403
   ▼
create(dto, actor)                                [appointments/appointments.service.ts]
   ▼
validateNewAppointment
   ├─ rol profesional ──► 403 El profesional no crea turnos ajenos
   ├─ parseRange ── endAt <= startAt ──► 400 endAt debe ser posterior a startAt
   │                                      [appointments/appointment-rules.ts]
   ├─ assertCatalogExists
   │    ├─ findById profesional            [professionals/professionals.service.ts]
   │    │     no está ──► 404
   │    ├─ findById paciente               [patients/patients.service.ts]
   │    │     no está ──► 404
   │    ├─ findById sucursal               [branches/branches.service.ts]
   │    │     no está ──► 404
   │    └─ branchIds con valores y esta sucursal no está
   │          ──► 400 El profesional no atiende en esa sucursal
   │          (branchIds [] no frena)
   └─ assertAvailability → coversSlot (§8)
         no cubre ──► 400 El horario está fuera de la disponibilidad del profesional
   ▼
dto.entreturno ── sí ──► §9c
               └─ no ──► §9b
```

### 9b. Hueco libre o lista de espera

```
bookOrJoinWaitlist
   ▼
runSerializable (15s)                             [prisma/prisma.service.ts]
   │  Postgres P2034 ──► 409 El turno acaba de ser ocupado
   │                      [prisma/prisma.errors.ts]
   ├─ findActiveOverlap                           [appointments/appointment-rules.ts]
   │     programado o en_sala_de_espera, mismo profesional y sucursal,
   │     rangos que se pisan (atendido y cancelado no cuentan)
   │
   ├─ HAY SOLAPE
   │    └─ joinWaitlist  día = clinicDay(startAt) en CLINIC_TZ
   │         ya estaba (mismo paciente, profesional, sucursal, día, sin promover)
   │           → devuelve la fila, no crea otra
   │         si no → waitlistEntry.create
   │         ──► result lista_de_espera
   │
   └─ LIBRE
        ├─ appointment.create  status programado
        └─ addBinnacleNote "Creó el turno"  kind agenda   [binnacle/binnacle-note.ts]
              ──► result programado
   ▼
notify                                            [notifications/log-notification.adapter.ts]
   ├─ espera → type waitlist_joined   LOG  (también si la fila ya existía)
   └─ libre  → type created           LOG  "Turno programado"
                                              ──► 201
```

### 9c. Entreturno

No usa la lista de espera. Si no hay a quién acortar, corta.

```
insertEntreturno
   ├─ clockMinute(startAt) en CLINIC_TZ          [availability/time-in-zone.ts]
   │     no es :15 ni :45 ──► 400 Un entreturno solo puede empezar a los :15 o a los :45
   │                            [appointment-rules.ts isEntreturnoStart]
   ▼
runSerializable
   │  P2034 ──► 409 El turno acaba de ser ocupado
   ├─ busca uno activo (programado o en sala) que ya empezó y todavía no terminó
   │     no hay ──► 400 No hay un turno en curso para acortar en ese horario
   ├─ el entreturno no termina cuando terminaba ese turno
   │     ──► 400 El entreturno tiene que terminar cuando terminaba el turno que se acorta
   ├─ 1. acorta: endAt = inicio del entreturno, acortado true
   │      (el estado no cambia)
   │      addBinnacleNote "Se acortó por un entreturno"
   └─ 2. crea el nuevo: status programado, entreturno true
          addBinnacleNote "Creó un entreturno"
   ▼
notify type created         LOG  "Entreturno programado"
notify type status_changed  LOG  "Turno acortado por un entreturno"
       (el tipo dice status_changed aunque el estado quedó igual)
                                              ──► 201 { result programado, appointment, acortado }
```

---

## 10. Listado de turnos — `GET /api/v1/appointments`

```
GET /api/v1/appointments
  [appointments/appointments.controller.ts]
   │  §0, sin @Roles
   ▼
list(query, actor)                                [appointments/appointments.service.ts]
   ├─ visibleProfessionalId
   │    ├─ no es profesional → filtra por query.professionalId (opcional)
   │    ├─ profesional sin professionalId ──► 403 El profesional no está vinculado
   │    └─ profesional → fuerza su id (ignora el query)
   └─ findMany  status, sucursal, startAt entre from y to
         orden startAt
         vacío ──► 200 []
                                              ──► 200
```

---

## 11. Un turno — `GET /api/v1/appointments/:id`

```
GET /api/v1/appointments/:id
  [appointments/appointments.controller.ts]
   │  §0, sin @Roles
   ▼
findById                                          [appointments/appointments.service.ts]
   ├─ no está ──► 404 Turno no encontrado
   └─ assertCanView
         profesional de otro ──► 403 No podés ver turnos de otro profesional
                                              ──► 200
```

---

## 12. Agenda — `GET /api/v1/professionals/:id/agenda?from&to`

```
GET /api/v1/professionals/:id/agenda
  [appointments/professionals-agenda.controller.ts]
   │  §0, sin @Roles
   │  from o to que no son fecha ──► 400
   ▼
agenda                                            [appointments/appointments.service.ts]
   ├─ profesional mirando otro id ──► 403 Solo podés ver tu propia agenda
   ├─ findById profesional ── no está ──► 404 Profesional no encontrado
   └─ findMany  startAt entre from y to, status distinto de cancelado
                                              ──► 200
```

---

## 13. Reprogramar — `PATCH /api/v1/appointments/:id` con `startAt` o `endAt`

Si el body trae horario, manda este flujo aunque también venga `status`
(el estado nuevo se ignora). `notes` sí se copia al turno nuevo.

```
PATCH /api/v1/appointments/:id
  [appointments/appointments.controller.ts]
   │  §0, sin @Roles (enfermería también llega)
   ▼
update → findById (§11)                          [appointments/appointments.service.ts]
   ▼
reschedule
   ├─ rol profesional ──► 403 El profesional no reprograma turnos
   ├─ assertCanReschedule
   │     no está programado ──► 400 Este turno no se puede reprogramar
   │     (cancelado, atendido, en sala)
   ├─ parseRange  el extremo que no vino se queda ── endAt <= startAt ──► 400
   └─ coversSlot (§8) ── no cubre ──► 400 fuera de disponibilidad
   ▼
runSerializable
   │  P2034 ──► 409 El turno acaba de ser ocupado
   ├─ relee el turno
   │     ya no se puede reprogramar ──► 400 Este turno no se puede reprogramar
   ├─ findActiveOverlap del rango nuevo, excluyendo este id
   │     solape activo ──► 409 El profesional ya tiene un turno activo en ese horario
   ├─ 1. el viejo pasa a cancelado
   │      addBinnacleNote "Reprogramó el turno"
   ├─ 2. crea otro programado (mismo paciente, profesional, sucursal)
   │      addBinnacleNote "Creó el turno reprogramado"
   └─ 3. promoteFromWaitlist sobre el hueco viejo (§15)
   ▼
notify type rescheduled  LOG  "Reprogramado desde {id viejo}"
       (no manda type cancelled por el viejo)
notifyPromoted si hubo promoción (§15)
                                              ──► 200 el turno nuevo, y promoted si hubo
```

---

## 14. Cambio de estado — `PATCH /api/v1/appointments/:id` con `status` y sin horario

```
update
   │  sin startAt ni endAt, con status
   ▼
changeStatus                                      [appointments/appointments.service.ts]
   ├─ profesional y el estado no es atendido
   │     ──► 403 El profesional solo puede marcar el turno como atendido
   └─ canTransition                              [appointments/appointment-rules.ts]
         programado        → en_sala_de_espera | cancelado
         en_sala_de_espera → atendido | cancelado
         atendido          → (nada)  400 Un turno en estado final no avanza
         cancelado         → (nada)  400 Un turno cancelado no avanza
         otro salto        → 400 No se puede pasar de {desde} a {hasta}

   ├─ NO es cancelado
   │    ├─ appointment.update
   │    ├─ addBinnacleNote statusNote
   │    │     en sala → "Anunció al paciente en sala de espera"
   │    │     atendido → "Marcó el turno como atendido"
   │    └─ notifyStatus
   │          en sala → status_changed  LOG  "Paciente en sala de espera. Avisar al consultorio."
   │          otro     → status_changed  LOG  "Estado: {estado}"
   │          (no es la transacción serializable; la bitácora va después del update)
   │                                              ──► 200
   └─ cancelado ──► §15, pero entrando por este PATCH
```

Solo `notes`, sin horario ni estado: update de notas, sin bitácora y sin aviso.
Body vacío: devuelve el turno y no escribe.

---

## 15. Cancelar y promover la lista

Dos puertas. El service de las dos, si el estado nuevo es cancelado, es `changeStatus`.

```
POST /api/v1/appointments/:id/cancel
  [appointments/appointments.controller.ts]
   │  §0 ── no es admin ni secretaría ──► 403
   │        (enfermería no entra por acá)
   ▼
cancel                                            [appointments/appointments.service.ts]
   ├─ findById (§11)
   └─ rol profesional ──► 403 El profesional no cancela turnos
   ▼
changeStatus(cancelado)
   │  transición inválida ──► 400 (§14)
   ▼
runSerializable
   │  P2034 ──► 409 El turno acaba de ser ocupado
   ├─ relee ── no está ──► 404 Turno no encontrado
   ├─ canTransition de nuevo ── no ──► 400
   ├─ status cancelado
   ├─ addBinnacleNote "Canceló el turno"
   └─ promoteFromWaitlist
        ├─ findActiveOverlap del hueco ── sigue ocupado ──► null (no promueve)
        ├─ primer waitlist del día (createdAt, promotedAppointmentId null)
        │     no hay ──► null
        ├─ appointment.create  programado, mismas horas
        │     notes "Asignado desde la lista de espera"
        ├─ marca promotedAppointmentId
        ├─ bitácora del nuevo "Asignó el horario liberado desde la lista de espera"
        └─ bitácora del cancelado "El horario pasó al primero de la lista de espera"
   ▼
notify type cancelled  LOG  "Estado: cancelado"
notifyPromoted
   └─ si hubo  type waitlist_promoted  LOG
        "Lista de espera: avisar al paciente. Quedó programado en el horario liberado"
                                              ──► 200 el cancelado, y promoted si hubo
```

Por el PATCH (§14) un enfermero sí puede mandar `status: cancelado`: ese endpoint no
tiene `@Roles`. El POST de arriba, no.

---

## 16. Bitácora — `GET /api/v1/binnacle/:appointmentId?kind`

```
GET /api/v1/binnacle/:appointmentId
  [binnacle/binnacle.controller.ts]
   │  §0, sin @Roles
   │  kind distinto de agenda | signos | medicacion ──► 400
   ▼
list                                              [binnacle/binnacle.service.ts]
   ├─ no es profesional → findMany, kind opcional, orden createdAt
   └─ profesional
        ├─ sin kind, o kind agenda
        │     ──► 403 No podés leer la bitácora de la agenda
        ├─ turno inexistente ──► 404 Turno no encontrado
        ├─ turno de otro ──► 403 No podés ver turnos de otro profesional
        └─ kind signos o medicacion, y es su turno → findMany
                                              ──► 200
```

Quién escribe, y con qué `kind`:

| Quién | Texto | kind |
|---|---|---|
| alta, entreturno, reprogramar, estado, cancelar, promoción | el del paso | agenda |
| signos (§17) | "El control de signos salió bien" o "Signos fuera de rango: temperatura mayor a 39 °C" | signos |
| dosis (§19) | "Administró {insumo} {dosis} (en horario)" | medicacion |

---

## 17. Signos — `POST /api/v1/appointments/:id/vitals`

```
POST /api/v1/appointments/:id/vitals
  [nursing/nursing.controller.ts]
   │  §0 ── no es admin ni enfermería ──► 403
   ▼
recordVitals                                      [nursing/nursing.service.ts]
   ├─ findAppointment ── no está ──► 404 Turno no encontrado
   │     (no mira el estado: también un cancelado)
   ├─ isFever  temperatura > 39                  [nursing/nursing.ts]
   └─ transacción
        ├─ vitalSign.create  fueraDeRango = fiebre
        └─ addBinnacleNote vitalNote  kind signos
   ▼
si fiebre, después del commit:
   notify type guardia  LOG  "Temperatura {n} °C. Avisar al médico de guardia."
   (39 justo no es fiebre)
                                              ──► 201
```

---

## 18. Indicación — `POST /api/v1/patients/:id/prescriptions`

```
POST /api/v1/patients/:id/prescriptions
  [nursing/nursing.controller.ts]
   │  §0 ── no es admin ni profesional ──► 403
   ▼
prescribe                                         [nursing/nursing.service.ts]
   ├─ findById paciente ── no está ──► 404
   ├─ findById insumo ── no está ──► 404 Insumo no encontrado
   └─ prescription.create  (no descuenta stock, no escribe bitácora, no avisa)
                                              ──► 201
```

---

## 19. Dosis — `POST /api/v1/appointments/:id/doses`

```
POST /api/v1/appointments/:id/doses
  [nursing/nursing.controller.ts]
   │  §0 ── no es admin ni enfermería ──► 403
   ▼
giveDose                                          [nursing/nursing.service.ts]
   ├─ findAppointment ── no está ──► 404 Turno no encontrado
   ├─ prescription.findUnique
   │     no está, o el paciente no es el del turno
   │       ──► 404 Indicación no encontrada
   ├─ isWithinDoseWindow  |administradaEn − horaIndicada| <= 30 min
   │     afuera ──► 400 La dosis está fuera de los 30 minutos de la hora indicada
   │                 [nursing/nursing.ts]
   ▼
transacción
   ├─ 1. takeOneUnit                               [supplies/supplies.service.ts]
   │      updateMany stock > 0, decrement 1
   │      count 0 ──► 409 No queda stock de ese insumo
   ├─ 2. doseAdministration.create
   ├─ 3. addBinnacleNote doseNote  kind medicacion
   └─ 4. chargeSupplyToActiveStay                  [billing/billing.service.ts]
          internación abierta (dischargedAt null) de ese paciente
            no hay ──► accountLine null (la dosis igual queda, el stock igual baja)
            hay → accountLine "Insumos de Farmacia" por supply.price
                                              ──► 201 { dosis, stockRestante, accountLine }
```

---

## 20. Triaje

### 20a. Clasificar — `POST /api/v1/triage`

```
POST /api/v1/triage
  [triage/triage.controller.ts]
   │  §0 ── no es admin, secretaría o enfermería ──► 403
   ▼
classify                                          [triage/triage.service.ts]
   ├─ findById paciente ── no está ──► 404
   ├─ findById sucursal ── no está ──► 404
   ├─ triageEntry.create  (no hay estado ni cierre)
   └─ isVitalRisk solo si level rojo               [triage/triage.ts]
         rojo → notify type guardia  LOG
              "Riesgo vital (código rojo). Avisar a los médicos de guardia."
         amarillo o verde → sin aviso
                                              ──► 201
```

### 20b. Cola — `GET /api/v1/triage?branchId`

```
GET /api/v1/triage
  [triage/triage.controller.ts]
   │  §0, sin @Roles
   ▼
queue                                             [triage/triage.service.ts]
   ├─ findById sucursal ── no está ──► 404
   └─ todos los ingresos de la sucursal, ordenados en memoria
         byRiskThenArrival: rojo, amarillo, verde; a igual color, el más viejo
         [triage/triage.ts]
         (no saca a los que ya se atendieron: no hay ese dato)
                                              ──► 200
```

---

## 21. Insumos

```
GET /api/v1/supplies
  [supplies/supplies.controller.ts]
   │  §0, sin @Roles
   └─ list() por nombre                           [supplies/supplies.service.ts]
                                              ──► 200

POST /api/v1/supplies
   │  §0 ── no es admin ──► 403
   └─ supply.create
         nombre repetido (P2002) ──► 409 Ya existe un insumo con ese nombre
                                              ──► 201

PATCH /api/v1/supplies/:id
   │  §0 ── no es admin ──► 403
   ├─ findById ── no está ──► 404 Insumo no encontrado
   └─ supply.update
         nombre repetido: P2002 sin traducir
                                              ──► 200
```

El descuento de una unidad no tiene ruta: lo hace la dosis (§19).

---

## 22. Camas e internación

### 22a. Camas

```
GET /api/v1/beds
  [beds/beds.controller.ts]
   │  §0, sin @Roles
   └─ list() por número                           [beds/beds.service.ts]
                                              ──► 200

POST /api/v1/beds
   │  §0 ── no es admin ──► 403
   └─ bed.create  status libre
         número repetido (P2002) ──► 409 Ya existe una cama con ese número
                                              ──► 201

PATCH /api/v1/beds/:id/status
   │  §0 ── no es admin ni enfermería ──► 403
   ▼
changeStatus                                      [beds/beds.service.ts]
   ├─ findById ── no está ──► 404 Cama no encontrada
   ├─ canChangeBedStatus                          [beds/bed-status.ts]
   │     libre        → bloqueada
   │     bloqueada    → libre
   │     en_limpieza  → libre
   │     ocupada      → (nada)  400 Una cama ocupada solo se libera con el alta del paciente
   │     otro salto   → 400 No se puede pasar la cama de {desde} a {hasta}
   └─ updateMany si sigue en el estado leído
         count 0 ──► 409 La cama acaba de cambiar de estado
                                              ──► 200 { ...cama, status nuevo }
```

A ocupada solo se llega internando (§22b). El PATCH no ofrece ese estado.

### 22b. Internar — `POST /api/v1/admissions`

```
POST /api/v1/admissions
  [admissions/admissions.controller.ts]
   │  §0 ── no es admin ni secretaría ──► 403
   ▼
admit                                             [admissions/admissions.service.ts]
   ├─ findById paciente ── no está ──► 404
   ▼
transacción
   ├─ ya hay una con dischargedAt null
   │     ──► 409 El paciente ya está internado
   ├─ beds.occupy                                 [beds/beds.service.ts]
   │     ├─ no está la cama ──► 404
   │     ├─ status distinto de libre ──► 409 La cama no está libre
   │     └─ updateMany libre → ocupada
   │           perdió la carrera ──► 409 La cama acaba de ocuparse
   └─ admission.create
         protocolTasks = buildProtocol(reason)    [admissions/protocols.ts]
           cirugia      → ayuno 8 h, vía, signos cada 2 h
           respiratorio → saturación, aislamiento
           pediatria    → signos cada 4 h, peso, acompañante
         (queda copiado: después no se relee el protocolo)
                                              ──► 201
```

### 22c. Internaciones abiertas y una

```
GET /api/v1/admissions
  [admissions/admissions.controller.ts]
   │  §0, sin @Roles
   └─ dischargedAt null, orden admittedAt         [admissions/admissions.service.ts]
                                              ──► 200

GET /api/v1/admissions/:id
   └─ findById ── no está ──► 404 Internación no encontrada
                                              ──► 200
```

### 22d. Alta — `POST /api/v1/admissions/:id/discharge`

```
POST /api/v1/admissions/:id/discharge
  [admissions/admissions.controller.ts]
   │  §0 ── no es admin ni secretaría ──► 403
   ▼
discharge                                         [admissions/admissions.service.ts]
   ├─ findById ── no está ──► 404
   ├─ ya tiene dischargedAt ──► 400 La internación ya tiene alta
   ▼
transacción
   ├─ beds.sendToCleaning                         [beds/beds.service.ts]
   │     pone en_limpieza sin mirar el estado anterior
   └─ dischargedAt = ahora
         (no cobra, no mira protocolTasks, no avisa)
                                              ──► 201
```

La cama vuelve a libre solo con el PATCH de §22a (`en_limpieza` → `libre`).

---

## 23. Cuenta de la internación — `GET /api/v1/admissions/:id/account`

```
GET /api/v1/admissions/:id/account
  [billing/billing.controller.ts]
   │  §0 ── no es admin ni secretaría ──► 403
   ▼
stayAccount                                       [billing/billing.service.ts]
   └─ accountLine de ese id, suma amount
         si el id no existe, igual responde líneas vacías y total 0 (no hay 404)
                                              ──► 200 { admissionId, lines, total }
```

Las líneas las crea la dosis (§19), no este GET.

---

## 24. Cargo de la consulta — `POST /api/v1/appointments/:id/charges`

```
POST /api/v1/appointments/:id/charges
  [billing/billing.controller.ts]
   │  §0 ── no es admin ni secretaría ──► 403
   ▼
chargeConsultation(id, price)                     [billing/billing.service.ts]
   ├─ turno no está ──► 404 Turno no encontrado
   │     (no mira el estado)
   ├─ ya hay algún charge de ese turno ──► 409 La consulta ya fue facturada
   ├─ findById paciente ── no está ──► 404
   └─ splitByCoverage(coverage, price, copay)     [billing/coverage.ts]
         publica    → paciente 0 + estado price
         prepaga    → paciente min(copay, price) + prepaga el resto
         particular → paciente price
         transacción: un charge por pagador
         (sin bitácora y sin aviso)
                                              ──► 201
```

---

## Avisos, bitácora y estado por flujo

No hay mail. El aviso es una línea de LOG (`LogNotificationAdapter`).

| Flujo | Estado que deja | Bitácora | Aviso |
|---|---|---|---|
| Alta con hueco libre | turno `programado` | agenda "Creó el turno" | `created` |
| Alta con hueco tomado | sin turno; fila de espera (o la que ya estaba) | no | `waitlist_joined` |
| Entreturno | nuevo `programado` + `entreturno`; el otro sigue su estado, `acortado`, fin adelantado | agenda en los dos | `created` y `status_changed` |
| Reprogramar | viejo `cancelado`, nuevo `programado`; el hueco viejo puede promover | agenda en los dos, y las de §15 si promueve | `rescheduled`; `waitlist_promoted` si hubo. No manda `cancelled` |
| A sala de espera | `en_sala_de_espera` | agenda "Anunció al paciente…" | `status_changed` (texto de consultorio) |
| Atendido | `atendido` (final) | agenda "Marcó el turno como atendido" | `status_changed` |
| Cancelar | `cancelado` (final); puede nacer un `programado` de la lista | agenda "Canceló el turno" y, si promueve, las dos de §15 | `cancelled`; `waitlist_promoted` si hubo |
| Signos en rango | nada del turno | signos "salió bien" | no |
| Signos > 39 °C | nada del turno; `fueraDeRango` | signos "fuera de rango…" | `guardia` |
| Indicación | fila `prescription` | no | no |
| Dosis | stock − 1; línea de cuenta solo si hay internación abierta | medicacion | no |
| Triaje rojo | fila `triageEntry` | no | `guardia` |
| Triaje amarillo o verde | fila `triageEntry` | no | no |
| Internar | admisión + cama `ocupada` + protocolo copiado | no | no |
| Alta de internación | `dischargedAt`; cama `en_limpieza` | no | no |
| Cargo de consulta | uno o dos `charge` según cobertura | no | no |
| Catálogo, login, salud, listados | el alta o el update de esa entidad | no | no |
