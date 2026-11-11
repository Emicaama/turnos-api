# Historias de usuario

Transcripción de `Historias de usuario.docx`, partida en bloques para citarlos (A1, A2, B1…). La cobertura de abajo describe el código actual de `turnos-api`.

## Cobertura aproximada

Esta API es una agenda de consultorio: secretaría reserva turnos contra la disponibilidad de un profesional, evita solapes con una transacción serializable, mueve estados simples y anota una bitácora. También clasifica la guardia (A5), registra signos y medicación sobre un turno (B1, B2), interna pacientes en camas con su protocolo (B3, C1, C2), descuenta stock al medicar (C3) y factura por cobertura y por insumos (D1, D2). Hay un rol `enfermero`.

| ID | Historia | Cobertura |
|----|----------|-----------|
| A1 | Reserva de turno seguro | Sí |
| A2 | Entreturno dinámico | Sí |
| A3 | Lista de espera por cancelación | Sí |
| A4 | Transición del estado de atención | Sí |
| A5 | Triaje de guardia | Sí |
| B1 | Signos vitales | Sí |
| B2 | Medicación prescrita | Sí |
| B3 | Protocolos de atención (Builder) | Sí |
| C1 | Asignación segura de cama | Sí |
| C2 | Higiene y mantenimiento de camas | Sí |
| C3 | Descuento de stock | Sí |
| D1 | Cálculo de costos por cobertura | Sí |
| D2 | Cargo automático por insumos | Sí |

Las 13 historias están cubiertas.

**A1.** `POST /api/v1/appointments` deja el turno en `programado` si el horario está libre. La reserva corre en una transacción serializable: si dos recepcionistas entran juntas al mismo hueco, la que pierde responde `409` («El turno acaba de ser ocupado»).

**A2.** El mismo POST con `entreturno: true` solo si el inicio cae en `:15` o `:45` (hora de `CLINIC_TZ`). Acorta el turno que contiene ese instante y etiqueta `acortado` / `entreturno`.

**A3.** Si ese horario ya está ocupado, el mismo POST no abre otro endpoint: anota al paciente en la lista de espera de ese profesional, sucursal y día. Al cancelar (o reprogramar) el hueco, el primero de la cola queda `programado` ahí y el log pide avisar al paciente.

**A4.** Estados: `programado` → `en_sala_de_espera` → `atendido`, y `cancelado` desde los dos primeros. No hay `confirmado`. Un `cancelado` no pasa a `atendido` (`400`). Entrar a sala de espera deja un aviso al consultorio en el log.

**A5.** `POST /api/v1/triage` clasifica a un paciente sin turno en `rojo`, `amarillo` o `verde`. No crea un turno. `GET /api/v1/triage?branchId=` ordena la cola de esa sucursal: el rojo va primero y, a igual nivel, manda la llegada. El rojo deja un log `[guardia]`. Lo carga el enfermero, la secretaría o el admin.

**B1.** `POST /api/v1/appointments/:id/vitals` guarda presión, frecuencia y temperatura del turno. Hasta 39 °C la nota es `El control de signos salió bien` (`kind: signos`). Por encima, `fueraDeRango` queda en true y el log `[guardia]` avisa. Lo carga el enfermero o el admin.

**B2.** El profesional indica un insumo con `POST /api/v1/patients/:id/prescriptions`. El enfermero marca la toma con `POST /api/v1/appointments/:id/doses` solo si cae a ±30 minutos de `horaIndicada`; la bitácora (`kind: medicacion`) anota quién la dio y se descuenta una unidad del stock (C3).

**B3.** `POST /api/v1/admissions` genera `protocolTasks` según `reason`: `cirugia`, `respiratorio` o `pediatria`.

**C1.** La misma internación pasa la cama de `libre` a `ocupada` con un update condicional. Dos asignaciones simultáneas: una `201`, la otra `409` («La cama acaba de ocuparse»).

**C2.** El alta (`POST /api/v1/admissions/:id/discharge`) deja la cama `en_limpieza`. `PATCH /api/v1/beds/:id/status` la vuelve a `libre` o la bloquea por mantenimiento.

**C3.** Cada dosis descuenta 1 unidad del insumo de forma atómica (`stock > 0`); sin stock, `409`.

**D1.** `POST /api/v1/appointments/:id/charges` reparte el precio entre paciente, Estado o prepaga según la cobertura del paciente.

**D2.** Si el paciente está internado, la dosis agrega una línea «Insumos de Farmacia» a la cuenta de la estadía, ligada al `doseId`.

---

## A — Módulo de admisión

### A1 — Reserva de turno seguro

Épica: Gestión de agenda y control de concurrencia. Reservar y cancelar turnos sin que dos pacientes tomen el mismo horario a la vez, con bloqueos de base de datos o transacciones.

**Historia.** Como recepcionista, quiero reservar un turno disponible para un paciente de modo que quede bloqueado y no pueda ser tomado por nadie más.

**Dado** que el paciente "Carlos López" está registrado formalmente en el sistema.

**Escenario 1: Reserva exitosa de un turno disponible**

- Y el turno de las 10:00 AM con el Dr. Silva está disponible.
- Cuando el recepcionista selecciona el turno y confirma la reserva.
- Entonces el sistema debe asignar el turno a "Carlos López".
- Y el estado del turno debe cambiar inmediatamente a "Programado".

**Escenario 2: Manejo estricto de concurrencia al reservar**

- Dado que el turno de las 10:00 AM con el Dr. Silva está disponible.
- Cuando dos recepcionistas intentan confirmar la reserva de ese mismo turno en el mismo milisegundo para diferentes pacientes.
- Entonces el sistema debe procesar exitosamente solo la primera petición que ingrese a la base de datos.
- Y debe rechazar la segunda petición con un mensaje claro de que el turno acaba de ser ocupado.

**Cobertura: sí.** El alta queda `programado`. Dos reservas simultáneas del mismo hueco corren en una transacción serializable; la que pierde responde `409`.

### A2 — Inserción de entreturno dinámico

**Historia.** Como coordinador de agendas, quiero insertar un entreturno reduciendo el tiempo de atención de los turnos adyacentes para acomodar a un paciente de urgencia menor, sin superponer identificadores.

**Escenario 1: Recálculo automático de duración**

- Dado que el Dr. Silva tiene turnos de 30 minutos a las 10:00 AM y a las 10:30 AM.
- Cuando un usuario con privilegios inserta un entreturno a las 10:15 AM.
- Entonces el turno de las 10:00 AM pasa a durar 15 minutos.
- Y el entreturno ocupa de las 10:15 AM a las 10:30 AM.
- Y los turnos afectados quedan etiquetados para avisar al médico que tiene menos tiempo por paciente.

**Cobertura: sí.** `entreturno: true` en el POST de turnos. Solo empieza a los `:15` o `:45`. El turno que cubre ese inicio se acorta y ambos quedan marcados (`acortado`, `entreturno`).

### A3 — Lista de espera por cancelación

**Historia.** Como recepcionista, quiero agregar un paciente a la lista de entreturnos (standby) para que, si alguien cancela ese día, el sistema le asigne el horario solo.

**Escenario 1: Promoción automática desde la lista de espera**

- Dado que la agenda del Dr. Silva de hoy está llena.
- Y "Luis Medina" es el primero de la cola de standby.
- Cuando el paciente de las 11:00 AM anula su cita.
- Entonces el sistema libera ese horario.
- Y desencola a "Luis Medina" y le asigna las 11:00 AM.
- Y alerta al recepcionista para avisar al paciente.

**Cobertura: sí.** Si el horario pedido ya está tomado, el POST de turnos encola solo. Al liberarse ese día, el primero de la cola recibe el hueco y el log pide avisar al paciente.

### A4 — Transición del estado de atención

Épica: máquina de estados del turno (patrón State).

Estados pedidos:

| Estado | Cuándo |
|--------|--------|
| Programado | Al terminar la reserva |
| Confirmado | Cuando el paciente revalida que va a asistir |
| En Sala de Espera | Cuando se anuncia en recepción |
| Atendido | Al cerrar la consulta |
| Cancelado | Si el paciente o la clínica anulan |

**Historia.** Como personal de admisión, quiero actualizar el estado del turno cuando el paciente llega, para que los médicos lo sepan.

**Escenario 1: Transición lógica permitida**

- Dado que "Juan Gómez" tiene un turno "Confirmado".
- Cuando se anuncia en recepción.
- Entonces el recepcionista puede pasarlo a "En Sala de Espera".
- Y se alerta al módulo del consultorio.

**Escenario 2: Transición inválida**

- Dado un turno "Cancelado".
- Cuando intentan pasarlo directo a "Atendido".
- Entonces el sistema bloquea la acción.
- Y devuelve un error de negocio: un turno cancelado no avanza.

**Cobertura: sí.** Estados reales: `programado`, `en_sala_de_espera`, `atendido`, `cancelado`. `confirmado` no existe: de programado se anuncia directo en sala de espera y eso avisa al consultorio por log. Un cancelado no avanza.

### A5 — Triaje de guardia

Épica: clasificación de urgencias y colas.

**Historia.** Como enfermero de guardia, quiero registrar y clasificar la urgencia de un paciente recién llegado para que entre a la cola con la prioridad correcta.

**Escenario 1: Priorización por nivel de triaje**

- Dado un paciente sin cita que entra por urgencias.
- Cuando el enfermero lo clasifica como "Riesgo Vital" (código rojo).
- Entonces el sistema lo pone primero en la cola y corre a los de menor riesgo.
- Y alerta en los monitores de los médicos de guardia.

**Cobertura: sí.** `POST /api/v1/triage` con `level: "rojo"` (riesgo vital), `amarillo` o `verde`. La cola de la sucursal sale en `GET /api/v1/triage?branchId=`, con el rojo delante de los riesgos menores. El código rojo avisa por log a la guardia. Clasifican el enfermero, la secretaría o el admin.

---

## B — Módulo de atención y enfermería

### B1 — Control y registro de signos vitales

Épica: cuidado diario y monitoreo. Trazabilidad de lo que hace enfermería en el turno.

**Historia.** Como enfermero de turno, quiero registrar los signos vitales de un paciente internado para seguir el monitoreo y avisar si hay una anomalía.

**Escenario 1: Signos estables**

- Dado que "Martín Torres" inició sesión.
- Y "Carlos López" está en la habitación 204.
- Cuando carga presión arterial, frecuencia cardíaca y temperatura en rango normal.
- Entonces el registro queda en la historia clínica con fecha y hora.
- Y se agrega una nota de enfermería de que el control salió bien.

**Escenario 2: Parámetro fuera de rango**

- Dado que se cargan los signos de "Carlos López".
- Cuando la temperatura supera los 39 °C.
- Entonces el registro se guarda destacado en rojo.
- Y se notifica con prioridad alta al médico de guardia de ese sector.

**Cobertura: sí.** `POST /api/v1/appointments/:id/vitals` guarda presión, frecuencia y temperatura sobre un turno existente. El paciente sale de ese turno; no hay habitación. Hasta 39 °C la nota de bitácora (`kind: signos`) es «El control de signos salió bien». Si la temperatura lo supera, el registro queda con `fueraDeRango: true` y el log avisa a la guardia. Presión y pulso se guardan y no disparan el aviso. Lo carga el enfermero o el admin. Los signos siguen colgando de un turno, no de la habitación.

### B2 — Administración de medicación prescrita

**Historia.** Como enfermero, quiero ver y confirmar la medicación que indicó el médico para que el paciente la reciba en horario.

**Escenario 1: Administración en tiempo**

- Dado "Ibuprofeno 400 mg cada 8 horas" para "Ana Rojas".
- Cuando el enfermero marca la dosis de las 14:00 como "Administrada" dentro de ±30 minutos.
- Entonces queda registrado qué usuario la aplicó.
- Y se descuenta el insumo del inventario del piso.

**Cobertura: sí.** `POST /api/v1/patients/:id/prescriptions` (profesional o admin) guarda el insumo (`supplyId`), la dosis y cada cuántas horas. `POST /api/v1/appointments/:id/doses` (enfermero o admin) acepta la toma si `administradaEn` cae a ±30 minutos de `horaIndicada`; si no, `400`. La bitácora (`kind: medicacion`) anota quién la aplicó y el insumo se descuenta del inventario (C3). El inventario es global, no por piso.

### B3 — Protocolos de atención (patrón Builder)

La épica arma un plan de cuidados distinto según el motivo de ingreso (cirugía, traumatismo, observación pediátrica).

**Historia.** Como sistema, quiero generar un protocolo base al admitir a un paciente en una habitación, para que enfermería tenga indicaciones sin una orden manual inicial.

**Escenario 1: Ingreso pre-quirúrgico**

- Dado que Admisión confirma el traslado a observación por una cirugía programada.
- Cuando Atención y Enfermería recibe el ingreso.
- Entonces un Pre-Op Protocol Builder genera las tareas.
- Incluye: verificar ayuno de 8 horas, colocar vía intravenosa periférica, signos vitales cada 2 horas.

**Escenario 2: Infección respiratoria**

- Dado un ingreso con diagnóstico inicial de neumonía.
- Cuando se inicia la estadía.
- Entonces un Respiratory Protocol Builder genera las tareas.
- Incluye monitoreo continuo de saturación y aislamiento de contacto y gotas.

**Cobertura: sí.** Al internar (`POST /api/v1/admissions`) el motivo elige el protocolo y la internación guarda `protocolTasks`. `cirugia`: ayuno de 8 horas, vía intravenosa periférica, signos cada 2 horas. `respiratorio`: saturación continua, aislamiento de contacto y gotas. `pediatria`: signos cada 4 horas, peso y balance hídrico, acompañante permanente. El "builder" es un mapa motivo → tareas en `src/admissions/protocols.ts`, no una clase por protocolo. No hay traumatismo.

---

## C — Gestión de recursos y camas

### C1 — Asignación segura de cama

Épica: repartir pacientes sin asignar dos veces la misma cama.

**Historia.** Como administrativo de piso, quiero asignar una cama libre a un paciente ingresado sin superposiciones.

**Necesidades técnicas del documento**

- Bloqueos de base (optimistas o pesimistas) para que dos personas no tomen la misma cama.
- Solo una cama libre puede ocuparse, en una transacción.
- Persistir paciente, cama y marca de tiempo de ingreso.

**Escenario 1: Asignación exitosa**

- Dado que "Laura Gómez" requiere internación.
- Y la cama 101 está "libre".
- Cuando el administrativo la asigna.
- Entonces el paciente queda vinculado a la habitación.
- Y la cama pasa a "ocupada".

**Escenario 2: Doble asignación**

- Dado que la cama 101 está libre.
- Cuando dos administrativos la asignan a la vez a pacientes distintos.
- Entonces solo la primera petición prospera, con bloqueo de base.
- Y la segunda se niega: la cama acaba de ocuparse.

**Cobertura: sí.** `POST /api/v1/admissions` con paciente, cama y motivo guarda `admittedAt` y pasa la cama a `ocupada` con `UPDATE ... WHERE status = 'libre'` dentro de la transacción. Si dos administrativos la asignan a la vez, el segundo recibe `409` «La cama acaba de ocuparse». Un paciente ya internado también recibe `409`. Asignan secretaría o admin.

### C2 — Higiene y mantenimiento de camas

La cama no puede pasar de ocupada a libre sin un paso intermedio.

**Historia.** Como personal de limpieza, quiero marcar una cama recién desocupada cuando ya está lista, para que pueda usarse de nuevo.

**Estados pedidos**

| Estado | Regla |
|--------|--------|
| Libres | Se puede asignar a un ingresante |
| Ocupadas | Solo pasan a limpieza tras el alta o el traslado |
| En limpieza | Bloqueada hasta que maestranza confirme |
| Bloqueadas | Fuera de servicio por mantenimiento |

**Escenario 1: Alta médica**

- Dado que un paciente deja la cama 205 por alta.
- Cuando se procesa la liberación clínica.
- Entonces la cama pasa a "en limpieza".
- Y no se le puede asignar otro paciente.

**Escenario 2: Maestranza termina**

- Dado que la cama 205 está "en limpieza".
- Cuando maestranza confirma que terminó.
- Entonces la cama pasa a "libre" y vuelve al mapa.

**Cobertura: sí.** `POST /api/v1/admissions/:id/discharge` deja la cama `en_limpieza`; ahí no se puede internar a nadie (`409`). `PATCH /api/v1/beds/:id/status` con `libre` confirma la limpieza. `libre` ↔ `bloqueada` cubre mantenimiento. Una cama `ocupada` no cambia a mano (`400`). No hay rol maestranza: confirman el enfermero o el admin. El traslado se hace como alta más una internación nueva.

### C3 — Descuento operativo de stock

El inventario se engancha con el trabajo del día.

**Historia.** Como gestor de inventario, quiero que al administrar un insumo se descuente solo del stock del piso.

**Necesidades técnicas del documento**

- Decremento de stock atómico.
- Reaccionar a eventos del módulo de enfermería.

**Escenario 1: Descuento tras administrar**

- Dado un stock de 50 unidades de "Ibuprofeno 400 mg".
- Cuando enfermería marca la dosis como "Administrada".
- Entonces el stock pasa a 49 de forma atómica.

**Cobertura: sí.** Al registrar la dosis, `UPDATE ... SET stock = stock - 1 WHERE stock > 0` corre en la misma transacción. La respuesta trae `stockRestante`. Sin stock, `409` y la dosis no se guarda. La "reacción al evento" es una llamada directa dentro de esa transacción, sin bus de eventos.

---

## D — Facturación y finanzas

### D1 — Cálculo dinámico de costos (patrón Strategy)

El costo depende de la cobertura: pública, prepaga o particular.

| Cobertura | Regla |
|-----------|--------|
| Pública | Subsidia el 100 %. El paciente paga 0 |
| Prepaga | Copago fijo al paciente; el resto se factura a la prepaga |
| Particular | El paciente paga el 100 % del nomenclador |

**Historia.** Como analista de facturación, quiero que el sistema calcule el costo de una consulta con las reglas de la obra social del paciente.

**Escenario 1: Cobertura pública**

- Dado que "Juan Gómez" tiene "Obra Social Pública".
- Cuando se factura una consulta general de 15 000 pesos.
- Entonces el cargo al paciente es 0.
- Y queda un cargo subsidiado de 15 000 a nombre del Estado o ente regulador.

**Escenario 2: Medicina prepaga**

- Dado que "Ana Rojas" tiene "Medicina Prepaga Premium".
- Y el copago fijo de esa prepaga es 3 000 pesos.
- Cuando se factura una consulta de 15 000 pesos.
- Entonces el paciente debe 3 000.
- Y se reclaman 12 000 a la prepaga.

**Cobertura: sí.** El paciente tiene `coverage` (`publica`, `prepaga`, `particular`) y `copay`. `POST /api/v1/appointments/:id/charges` con `{ price }` guarda un `Charge` por cada pagador. La estrategia es un mapa cobertura → regla en `src/billing/coverage.ts`. No hay nomenclador: el precio llega en el request. Una consulta se factura una vez (`409`).

### D2 — Cargo automático por consumo de insumos

Back-office escucha a enfermería sin frenar la atención.

**Historia.** Como sistema de back-office, quiero escuchar los consumos de inventario de enfermería e imputarlos a la cuenta de la estadía.

**Escenario 1: Facturación tras administrar**

- Dado que "Carlos López" está internado con una cuenta de gastos activa.
- Cuando llega el evento "MedicacionAdministrada" por 1 unidad de "Ibuprofeno 400 mg".
- Entonces se busca el precio vigente.
- Y se agrega una línea "Insumos de Farmacia" a la cuenta.
- Y esa línea queda ligada al id del evento, para auditoría.

**Cobertura: sí.** Cuando se registra una dosis y el paciente tiene una internación activa, se crea una `AccountLine` «Insumos de Farmacia» con el `price` vigente del insumo y el `doseId` (único, para auditoría). `GET /api/v1/admissions/:id/account` devuelve las líneas y el total. Corre en la transacción de la dosis, sin eventos asíncronos.
