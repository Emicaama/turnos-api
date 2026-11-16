# API

Prefijo global: `api/v1`. Auth JWT Bearer en casi todas las rutas (login y health son públicos). Roles: `admin` | `secretaria` | `profesional` | `enfermero`.

Documentación interactiva: **Swagger** en `/docs`.  
Colección Postman por historia: [Turnos-API-Historias-A-D.postman_collection.json](Turnos-API-Historias-A-D.postman_collection.json) + [Turnos-API-Local.postman_environment.json](Turnos-API-Local.postman_environment.json).

## Contratos transversales

| Concepto | Valores |
|----------|---------|
| Estados de turno | `programado` · `en_sala_de_espera` · `atendido` · `cancelado` |
| Triaje | `rojo` · `amarillo` · `verde` |
| Cama | `libre` · `ocupada` · `en_limpieza` · `bloqueada` |
| Cobertura | `publica` · `prepaga` · `particular` |
| Errores comunes | `401` sin token · `403` rol · `400` body · `404` · `409` conflicto |

## Índice de endpoints

| Método | URL | Qué hace | Historia |
|--------|-----|----------|----------|
| GET | `/health` | Ping Postgres | — |
| POST | `/auth/login` | Emite JWT | — |
| GET | `/users/me` | Payload del token | — |
| GET/POST/PATCH | `/users` | Usuarios (admin) | — |
| GET/POST/PATCH | `/branches` | Sucursales | — |
| GET/POST/PATCH/DELETE | `/specialties` | Especialidades | — |
| GET/POST/PATCH | `/patients` | Pacientes | — |
| GET/POST/PATCH | `/professionals` | Profesionales | — |
| GET | `/professionals/:id/agenda` | Agenda por rango | A4 |
| GET/POST/PATCH | `/availability` | Franjas semanales | A1 |
| POST | `/appointments` | Programa o encola lista de espera | A1–A3 |
| GET | `/appointments` | Lista / filtra turnos | A4 |
| GET | `/appointments/waitlist` | Lista de espera pendiente | A3 |
| GET/PATCH | `/appointments/:id` | Detalle / estado / reprogramar | A4 |
| POST | `/appointments/:id/cancel` | Cancela (puede promover espera) | A3, A4 |
| POST | `/appointments/:id/charges` | Factura consulta por cobertura | D1 |
| GET | `/binnacle/:appointmentId` | Bitácora del turno | A4 |
| GET | `/binnacle/admissions/:admissionId` | Bitácora de la internación | B1, B2 |
| POST/GET | `/triage` | Clasificar / cola de guardia | A5 |
| GET/POST | `/beds` | Mapa / crear cama | C1 |
| PATCH | `/beds/:id/status` | Liberar o bloquear | C2 |
| POST/GET | `/admissions` | Internar / listar activas | C1, B3 |
| GET | `/admissions/:id` | Detalle + protocolo | B3 |
| POST | `/admissions/:id/discharge` | Alta → cama en limpieza | C2 |
| GET | `/admissions/:id/account` | Cuenta de la estadía | D2 |
| POST/GET | `/admissions/:id/vitals` | Signos (fiebre > 39) | B1 |
| POST | `/admissions/:id/doses` | Registrar toma | B2, C3, D2 |
| GET/POST | `/patients/:id/prescriptions` | Indicaciones | B2 |
| GET/POST | `/protocols` | Protocolos por motivo | B3 |
| GET/POST/PATCH | `/supplies` | Insumos y stock | C3 |

Todas las URLs de la tabla van bajo `/api/v1`.

Para el “qué llama a qué” de cada historia: [FLUJOS.md](FLUJOS.md).
