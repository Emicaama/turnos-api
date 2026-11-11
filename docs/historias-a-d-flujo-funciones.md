# Historias A–D — flujo con funciones

> Cada caja es un punto de [Historias de usuario.md](../Historias%20de%20usuario.md).
> `→` = llama a. Entre `[ ]`, el archivo desde `src/`.
> El aviso es un LOG de Nest, no un mail ni un monitor.
> Si la historia pide un paso que el código no hace, el diagrama lo dice en la misma línea.

```
                         ┌─────────────────────────────────────┐
                         │  A admisión                         │
                         │  A1 reserva · A2 entreturno         │
                         │  A3 lista de espera · A4 estados    │
                         │  A5 triaje (sin turno)              │
                         └──────────────────┬──────────────────┘
                                            │
              ┌─────────────────────────────┼─────────────────────────────┐
              ▼                             ▼                             ▼
   ┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
   │ B atención          │     │ C camas y stock     │     │ D facturación       │
   │ B1 signos           │     │ C1 ocupar cama      │     │ D1 cargo consulta   │
   │ B2 indicación + toma│     │ C2 limpieza         │     │ D2 línea de insumo  │
   │ B3 protocolo        │     │ C3 stock − 1        │     │                     │
   └──────────┬──────────┘     └──────────▲──────────┘     └──────────▲──────────┘
              │                           │                            │
              └──── dosis ────────────────┴──── si está internado ─────┘
                    (B2 llama a C3 y, si hay estadía, a D2)
                    (B3 y C1 salen juntos del POST de internación)
```

---

## A1 — Reserva de turno seguro

`POST /api/v1/appointments` sin `entreturno`. Admin o secretaría.

```
POST /api/v1/appointments
  [appointments/appointments.controller.ts]
   │  no es admin ni secretaría ──► 403
   ▼
create → validateNewAppointment                 [appointments/appointments.service.ts]
   ├─ parseRange ── fin <= inicio ──► 400 endAt debe ser posterior a startAt
   │                                   [appointments/appointment-rules.ts]
   ├─ paciente, profesional o sucursal inexistente ──► 404
   ├─ el profesional tiene sucursales y esta no está
   │     ──► 400 El profesional no atiende en esa sucursal
   └─ coversSlot ── fuera de franja ──► 400 fuera de la disponibilidad
   ▼
bookOrJoinWaitlist
   ▼
runSerializable (15s)                           [prisma/prisma.service.ts]
   │  Postgres P2034 ──► 409 El turno acaba de ser ocupado
   │                      [prisma/prisma.errors.ts]
   │     (este 409 es el escenario 2 de A1: la carrera la aborta la base)
   ├─ findActiveOverlap  programado o en_sala, mismo profesional y sucursal
   │     atendido y cancelado no bloquean
   │
   ├─ HAY SOLAPE ──► no es 409: encola (A3)
   │
   └─ LIBRE
        ├─ appointment.create  status programado
        └─ addBinnacleNote "Creó el turno"         [binnacle/binnacle-note.ts]
   ▼
notify type created  LOG "Turno programado"      [notifications/log-notification.adapter.ts]
                                              ──► 201 { result: programado }
```

La historia pide rechazar la segunda reserva con «el turno acaba de ser ocupado».
Ese texto solo sale si la transacción serializable aborta (`P2034`).
Si la primera ya quedó escrita y la segunda ve el solape, no hay `409`: entra a A3.

---

## A2 — Entreturno

El mismo POST, con `entreturno: true`. Misma validación de A1, después esta rama.

```
insertEntreturno                                  [appointments/appointments.service.ts]
   ├─ minuto de inicio en CLINIC_TZ (si no hay, UTC)
   │     no es :15 ni :45 ──► 400 Un entreturno solo puede empezar a los :15 o a los :45
   │                            [appointment-rules.ts isEntreturnoStart]
   ▼
runSerializable
   │  P2034 ──► 409 El turno acaba de ser ocupado
   ├─ busca uno activo que ya empezó y todavía cubre ese instante
   │     no hay ──► 400 No hay un turno en curso para acortar en ese horario
   ├─ el fin del entreturno no es el fin de ese turno
   │     ──► 400 El entreturno tiene que terminar cuando terminaba el turno que se acorta
   ├─ 1. acorta ese turno: endAt = inicio del entreturno, acortado true
   │      el estado no cambia
   │      bitácora "Se acortó por un entreturno"
   └─ 2. crea otro: programado, entreturno true
          bitácora "Creó un entreturno"
   ▼
LOG created        "Entreturno programado"
LOG status_changed "Turno acortado por un entreturno"
       (el estado del acortado no cambió; el tipo del aviso sí dice status_changed)
                                              ──► 201 { appointment, acortado }
```

La historia habla de acortar los turnos adyacentes (el de las 10:00 y el de las 10:30).
El código acorta un solo turno: el que contiene el `:15` o el `:45`.
No toca el turno que empieza cuando ese termina.

---

## A3 — Lista de espera

Dos entradas. No hay un endpoint propio de la lista.

```
        POST /appointments                         POST /appointments/:id/cancel
        hueco tomado (§A1)                         o PATCH con horario (reprogramar)
        [appointments.service.ts                   [appointments.controller.ts]
         bookOrJoinWaitlist]                        cancel / reschedule
                 │                                          │
                 │  joinWaitlist                            │  el viejo pasa a cancelado
                 │  mismo paciente, profesional,            │  (reprogramar solo si estaba
                 │  sucursal y día (CLINIC_TZ)              │   programado; si no ──► 400)
                 │  ya estaba y no fue promovido            │
                 │    → no crea otra fila                   ├─ findActiveOverlap del hueco
                 │  LOG waitlist_joined                     │     sigue ocupado ──► no promueve
                 │                                          ├─ no hay nadie en la cola ──► no promueve
                 └────────────────────────┬─────────────────┘
                                          ▼
                               promoteFromWaitlist          [appointments.service.ts]
                                  │  el primero por createdAt, sin promotedAppointmentId
                                  ├─ appointment.create  programado, mismas horas
                                  │     notes "Asignado desde la lista de espera"
                                  ├─ marca promotedAppointmentId
                                  └─ bitácora en el nuevo y en el liberado
                                          ▼
                               LOG waitlist_promoted
                               "Lista de espera: avisar al paciente..."
```

Cancelar por `POST .../cancel` es admin o secretaría. El profesional recibe `403`.
Reprogramar (`PATCH` con `startAt` o `endAt`) también promueve el hueco viejo
y avisa `rescheduled`, no `cancelled`. Si ese PATCH trae `status`, se ignora.

La historia solo nombra la cancelación. El código también desencola al reprogramar.

---

## A4 — Estados del turno

`PATCH /api/v1/appointments/:id` con `status` y sin horario.
Sin `@Roles`: entra cualquier rol logueado; el service frena al profesional.

```
changeStatus                                      [appointments/appointments.service.ts]
   ├─ profesional y el estado no es atendido
   │     ──► 403 El profesional solo puede marcar el turno como atendido
   └─ canTransition                              [appointments/appointment-rules.ts]
         programado        → en_sala_de_espera | cancelado
         en_sala_de_espera → atendido | cancelado
         atendido          → 400 Un turno en estado final no avanza
         cancelado         → 400 Un turno cancelado no avanza
         otro salto        → 400 No se puede pasar de {desde} a {hasta}

   ├─ en_sala_de_espera o atendido
   │    ├─ update del estado
   │    ├─ bitácora
   │    │     sala    → "Anunció al paciente en sala de espera"
   │    │     atendido → "Marcó el turno como atendido"
   │    └─ LOG status_changed
   │          sala → "Paciente en sala de espera. Avisar al consultorio."
   │          atendido → "Estado: atendido"
   │                                              ──► 200
   └─ cancelado ──► rama de A3 (promueve la lista)
```

La historia arranca en `confirmado` y de ahí pasa a sala.
Ese estado no existe: de `programado` se anuncia directo en sala.
El aviso al consultorio es la línea de log, no un módulo aparte.
`cancelado` → `atendido` responde el `400` que pide el escenario 2.

---

## A5 — Triaje de guardia

No crea turno. Admin, secretaría o enfermería.

//TODO: ver diferentes roles para enfermeros y administrativo

```
POST /api/v1/triage
  [triage/triage.controller.ts]
   │  otro rol ──► 403
   ▼
classify                                          [triage/triage.service.ts]
   ├─ paciente o sucursal inexistente ──► 404
   ├─ triageEntry.create  (rojo | amarillo | verde)
   └─ isVitalRisk solo rojo                       [triage/triage.ts]
         rojo → LOG guardia "Riesgo vital (código rojo). Avisar a los médicos de guardia."
         amarillo o verde → sin aviso
                                              ──► 201

GET /api/v1/triage?branchId=
   │  cualquier rol logueado
   ▼
queue
   ├─ sucursal inexistente ──► 404
   └─ todos los ingresos de esa sucursal, ordenados en memoria
         byRiskThenArrival: rojo, amarillo, verde; a igual color, el más viejo
                                              ──► 200
```

La historia habla de monitores de guardia. No hay pantalla: el alerta es el log.
La cola no cierra a nadie: no existe un estado de "ya atendido" en el triaje.

---

## B1 — Signos vitales

`POST /api/v1/appointments/:id/vitals`. Admin o enfermería.
El paciente sale del turno. No hay habitación.

//TODO: ver que sea solo funcione cuando un paciente este en estado ingresado no en appointments sino ver como plantearlo con otra tabla de bd para las camas [(ocupado/libre)-> unida a tabla de paciente]

```
recordVitals                                      [nursing/nursing.service.ts]
   ├─ turno inexistente ──► 404
   │     (no mira el estado: también un cancelado)
   ├─ isFever  temperatura > 39                   [nursing/nursing.ts]
   │     39 justo no es fiebre
   └─ transacción
        ├─ vitalSign.create  presión, pulso, temperatura, fueraDeRango
        └─ bitácora kind signos
              en rango → "El control de signos salió bien"
              fiebre   → "Signos fuera de rango: temperatura mayor a 39 °C"
   ▼
si fiebre, después del commit:
   LOG guardia "Temperatura {n} °C. Avisar al médico de guardia."
                                              ──► 201
```

Presión y pulso se guardan y no disparan el aviso.
La historia pide el control de un internado en una habitación, destacado en rojo.
El código cuelga del turno y marca `fueraDeRango: true`. No hay color ni habitación.

---

## B2 — Indicación y toma

La indicación y la toma son dos POST. No hay un GET para ver la medicación.
//TODO: VER no se que hizo aca

```
POST /api/v1/patients/:id/prescriptions
  [nursing/nursing.controller.ts]
   │  no es admin ni profesional ──► 403
   ▼
prescribe                                         [nursing/nursing.service.ts]
   ├─ paciente o insumo inexistente ──► 404
   └─ prescription.create  supplyId, dosis, cadaHoras
         no descuenta stock, no escribe bitácora, no avisa
                                              ──► 201

POST /api/v1/appointments/:id/doses
   │  no es admin ni enfermería ──► 403
   ▼
giveDose
   ├─ turno inexistente ──► 404
   ├─ la indicación no es de ese paciente ──► 404 Indicación no encontrada
   ├─ |administradaEn − horaIndicada| > 30 min
   │     ──► 400 La dosis está fuera de los 30 minutos de la hora indicada
   │          [nursing.ts isWithinDoseWindow]  (30 min justos sí pasan)
   ▼
transacción
   ├─ 1. takeOneUnit          → C3
   ├─ 2. doseAdministration.create  authorName = quien la dio
   ├─ 3. bitácora kind medicacion  "Administró {insumo} {dosis} (en horario)"
   └─ 4. chargeSupplyToActiveStay  → D2, o null si no está internado
                                              ──► 201 { dosis, stockRestante, accountLine }
```

La historia pide ver la indicación y descontar el stock del piso.
No hay listado de indicaciones. El stock es uno solo, no por piso (C3).

---

## B3 — Protocolo al internar

Sale del mismo POST que C1. No hay una clase Builder por motivo.
//TODO: VER VINCULACION CAMAS Y ADMISION y ver como se activa esto en el momento de el GET de cama 
```
POST /api/v1/admissions
  [admissions/admissions.controller.ts]
   │  no es admin ni secretaría ──► 403
   ▼
admit                                             [admissions/admissions.service.ts]
   ├─ paciente inexistente ──► 404
   ▼
transacción
   ├─ ya internado (dischargedAt null) ──► 409 El paciente ya está internado
   ├─ beds.occupy                         → C1
   └─ admission.create
         protocolTasks = buildProtocol(reason)    [admissions/protocols.ts]
           cirugia      → ayuno 8 h, vía periférica, signos cada 2 h
           respiratorio → saturación continua, aislamiento de contacto y gotas
           pediatria    → signos cada 4 h, peso y balance, acompañante
         se copia en la fila; después no se vuelve a armar
                                              ──► 201
```

La historia nombra un Pre-Op Protocol Builder y uno respiratorio, y no menciona pediatría.
El código es un mapa `reason → tareas`. No hay motivo traumatismo.
Cirugía y respiratorio coinciden con los dos escenarios.

---

## C1 — Asignación de cama

La ocupa `beds.occupy`, adentro de la transacción de B3. No es serializable:
el candado es el `UPDATE` condicional.

```
occupy(bedId)                                     [beds/beds.service.ts]
   ├─ no está la cama ──► 404
   ├─ status distinto de libre
   │     (ocupada, en_limpieza, bloqueada)
   │     ──► 409 La cama no está libre
   └─ updateMany WHERE id AND status = libre → ocupada
         count 0 ──► 409 La cama acaba de ocuparse
         count 1 ──► la admisión se crea con admittedAt
```

La historia pide que la segunda asignación simultánea reciba «la cama acaba de ocuparse».
Ese texto sale si las dos leyeron `libre` y una pierde el `updateMany`.
Si la primera ya commiteó, la segunda ve otro estado y responde «La cama no está libre».
No hay entidad habitación: el vínculo es `patientId` + `bedId`.

---

## C2 — Limpieza y bloqueo

```
POST /api/v1/admissions/:id/discharge
  [admissions/admissions.controller.ts]
   │  no es admin ni secretaría ──► 403
   ▼
discharge                                         [admissions/admissions.service.ts]
   ├─ no está ──► 404
   ├─ ya tiene alta ──► 400 La internación ya tiene alta
   ▼
transacción
   ├─ sendToCleaning → status en_limpieza         [beds/beds.service.ts]
   │     no mira el estado anterior
   └─ dischargedAt = ahora
         (ocupar esa cama ahora cae en C1: 409 La cama no está libre)
                                              ──► 201

PATCH /api/v1/beds/:id/status
  [beds/beds.controller.ts]
   │  no es admin ni enfermería ──► 403
   ▼
changeStatus                                      [beds/beds.service.ts]
   ├─ canChangeBedStatus                          [beds/bed-status.ts]
   │     en_limpieza → libre
   │     libre      → bloqueada
   │     bloqueada  → libre
   │     ocupada    → 400 Una cama ocupada solo se libera con el alta del paciente
   │     otro salto → 400 No se puede pasar la cama de {desde} a {hasta}
   └─ updateMany si sigue en el estado leído
         perdió la carrera ──► 409 La cama acaba de cambiar de estado
                                              ──► 200
```

No hay rol maestranza: el paso a `libre` lo hace enfermería o admin.
No hay traslado. La historia lo pide como otra forma de mandar la cama a limpieza;
en el código solo lo hace el alta.

---

## C3 — Descuento de stock

No tiene ruta. Lo llama el paso 1 de la dosis (B2), en la misma transacción.

```
takeOneUnit                                       [supplies/supplies.service.ts]
   └─ updateMany WHERE stock > 0  SET stock = stock - 1
         count 0 ──► 409 No queda stock de ese insumo
                      (la transacción vuelve atrás: no queda la dosis ni la línea D2)
         count 1 ──► devuelve el insumo ya descontado (stockRestante)
```

La historia pide reaccionar a un evento de enfermería y descontar el stock del piso.
Es una llamada directa, sin bus. El stock no está partido por piso.

---

## D1 — Cargo de la consulta

`POST /api/v1/appointments/:id/charges` con `{ price }`. Admin o secretaría.
El precio lo manda el request: no hay nomenclador.

```
chargeConsultation                                [billing/billing.service.ts]
   ├─ turno inexistente ──► 404
   │     (no mira si está atendido)
   ├─ ya hay algún charge de ese turno ──► 409 La consulta ya fue facturada
   ├─ paciente inexistente ──► 404
   └─ splitByCoverage(coverage, price, copay)     [billing/coverage.ts]
         publica    → paciente 0 + estado el precio
         prepaga    → paciente min(copago, precio) + prepaga el resto
         particular → paciente el precio
         una fila Charge por pagador
         (sin bitácora y sin log)
                                              ──► 201
```

La historia pide el patrón Strategy, una clase por cobertura.
El código es el mapa `SPLIT_BY_COVERAGE`. Los tres repartos coinciden con la tabla
de la historia (pública 0 + Estado, prepaga copago + resto, particular el total).

---

## D2 — Línea de insumo en la estadía

No tiene ruta de alta. La escribe el paso 4 de la dosis (B2).
Se lee con `GET /api/v1/admissions/:id/account` (admin o secretaría).

```
chargeSupplyToActiveStay                          [billing/billing.service.ts]
   ├─ internación con dischargedAt null de ese paciente
   │     no hay ──► null
   │                (la dosis y el stock de C3 igual se guardan)
   └─ accountLine
         concept "Insumos de Farmacia"
         amount  = price del insumo en ese momento
         doseId  único (liga la línea a la dosis)
                                              ──► sigue dentro de la transacción de B2

GET /api/v1/admissions/:id/account
  [billing/billing.controller.ts]
   └─ líneas de ese id, suma amount
         si el id no existe: líneas vacías y total 0 (no hay 404)
                                              ──► 200 { lines, total }
```

La historia pide escuchar el evento `MedicacionAdministrada` sin frenar la atención.
No hay evento: corre en la misma transacción que la dosis. Si el insert de la línea
falla, la dosis y el descuento también se revierten.

---

## Efectos por historia

| Historia | Qué deja | Bitácora | Aviso (log) |
|---|---|---|---|
| A1 libre | turno `programado` | "Creó el turno" | `created` |
| A1 carrera `P2034` | nada de esa petición | no | no · `409` |
| A2 | nuevo `programado` + `entreturno`; el otro `acortado`, mismo estado, fin adelantado | una en cada turno | `created` y `status_changed` |
| A3 encolar | fila de espera (o la que ya estaba) | no | `waitlist_joined` |
| A3 promover | nuevo `programado` en el hueco; el liberado sigue `cancelado` | en los dos | `waitlist_promoted` |
| A4 sala | `en_sala_de_espera` | "Anunció al paciente…" | `status_changed` (consultorio) |
| A4 atendido | `atendido` | "Marcó el turno como atendido" | `status_changed` |
| A4 cancelar | `cancelado`, y puede promover A3 | "Canceló el turno" | `cancelled` |
| A5 rojo | `triageEntry`, sin turno | no | `guardia` |
| A5 amarillo o verde | `triageEntry` | no | no |
| B1 en rango | signos, `fueraDeRango` false | kind `signos`, "salió bien" | no |
| B1 > 39 °C | signos, `fueraDeRango` true | kind `signos`, fuera de rango | `guardia` |
| B2 indicación | `prescription` | no | no |
| B2 toma | dosis + stock − 1 (C3); línea solo si hay internación (D2) | kind `medicacion` | no |
| B3 + C1 | internación con `protocolTasks`; cama `ocupada` | no | no |
| C2 alta | `dischargedAt`; cama `en_limpieza` | no | no |
| C2 PATCH | `libre` o `bloqueada` según la transición | no | no |
| C3 sin stock | nada (la transacción vuelve atrás) | no | no · `409` |
| D1 | uno o dos `charge` | no | no |
| D2 | `accountLine` "Insumos de Farmacia" ligada al `doseId` | no | no |
