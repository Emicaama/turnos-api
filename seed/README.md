# Seed (fuera de Nest)

Script standalone con `PrismaClient`. No está en `AppModule`.

```bash
npm run seed          # idempotente
npm run seed:reset    # limpia y regenera
```

Cuentas y arranque: [docs/EMPEZAR.md](../docs/EMPEZAR.md).

## Borrar cuando ya no haga falta

1. Borrá esta carpeta `seed/`.
2. Sacá `seed` y `seed:reset` de `package.json`.
3. En `docker-compose.yml`, quitá el paso de seed del command del `api`.
4. En e2e, dejá de importar `../seed/run`.
