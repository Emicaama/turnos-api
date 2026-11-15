# Postman — Turnos API (Historias A–D)

## Importar

1. Abrí Postman → **Import**.
2. Subí:
   - `Turnos-API-Historias-A-D.postman_collection.json`
   - `Turnos-API-Local.postman_environment.json` (opcional)
3. Seleccioná el environment **Turnos API — Local Docker**.

También está una copia en la raíz del repo: `../Turnos-API.postman_collection.json`.

## Orden sugerido para la presentación

1. **00 Setup** → Login secretaría → Cargar IDs del seed  
2. **A — Admisión** (A1 → A5)  
3. **B — Atención** (B1 → B3)  
4. **C — Camas y stock** (C1 → C3)  
5. **D — Facturación** (D1 → D2)  

## Regenerar

```bash
node scripts/generate-postman-collection.cjs
```
