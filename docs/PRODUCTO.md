# Producto

## En una frase

API REST para que una clínica gestione **turnos**, **guardia**, **internación**, **enfermería** y **facturación**, con roles JWT y Postgres.

## Stack

NestJS 11 · Prisma 6 · PostgreSQL 16 · JWT · Swagger en `/docs`  
Front Vue (opcional): `../Front-Hospital/FrontHospitall` vía proxy `/api`.

## Roles

| Rol | Puede |
|-----|--------|
| **Secretaría** | Turnos, pacientes, triaje, internación/alta, facturar consulta, ver cuentas |
| **Enfermero** | Triaje, signos, dosis, liberar/bloquear camas |
| **Profesional** | Su agenda, indicar medicación, protocolos, marcar `atendido` en turnos propios |
| **Admin** | Catálogo (sedes, especialidades, médicos, camas, insumos, usuarios) + todo lo anterior |

El paciente no usa la API: lo carga la secretaría o el admin.

## Historias cubiertas (A–D)

| ID | Historia | Idea corta |
|----|----------|------------|
| A1 | Reserva segura | Hueco libre → `programado`; carrera concurrente → `409` |
| A2 | Entreturno | Solo inicio `:15` / `:45`; acorta el turno que lo contiene |
| A3 | Lista de espera | Horario ocupado → encola; al cancelar, promueve al primero |
| A4 | Estados | `programado` → `en_sala_de_espera` → `atendido` (o `cancelado`) |
| A5 | Triaje | Cola `rojo` / `amarillo` / `verde` sin crear turno; rojo avisa en log |
| B1 | Signos | Sobre internación activa; temp **> 39 °C** → `fueraDeRango` + aviso guardia |
| B2 | Medicación | Indicación del médico + toma del enfermero (±30 min) |
| B3 | Protocolos | Tareas por motivo al internar |
| C1 | Camas | Solo cama `disponible` → `ocupada` (sin doble asignación) |
| C2 | Limpieza | Alta → `en_limpieza`; después `disponible` o `bloqueada` |
| C3 | Stock | Cada dosis descuenta 1 unidad (atómico) |
| D1 | Cobertura | Cargo de consulta según prepaga / pública / particular |
| D2 | Insumos | Línea en la cuenta de la estadía al medicar |

Texto completo de las historias: [Historias de usuario.md](Historias%20de%20usuario.md).  
Paso a paso con funciones y archivos: [FLUJOS.md](FLUJOS.md).

## Cómo se conectan

```
Login → catálogo (sedes, médicos, pacientes, franjas)
      → turnos / agenda / bitácora
      → triaje (guardia, sin turno)
      → internación (cama + protocolo)
           ├─ signos (fiebre → WARN guardia)
           ├─ dosis → stock − 1 → cuenta de estadía
           └─ alta → cama en limpieza
      → facturar consulta
```

## Notificaciones

No hay mail ni WhatsApp. El puerto de notificaciones escribe en la consola de Nest:

- turnos / lista de espera → `log`
- `guardia` (triaje rojo, fiebre > 39) → `warn`

Código: [`src/notifications/log-notification.adapter.ts`](../src/notifications/log-notification.adapter.ts).

## Fuera de alcance

SMTP real, cobro de pagos, WhatsApp, UI embebida en Nest (el front es otro proyecto).
