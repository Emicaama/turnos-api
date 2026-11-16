import { SEED_ACCOUNTS, disconnectSeed, runSeed } from './run';

async function main() {
  const force = process.env.SEED_FORCE === '1';
  try {
    const result = await runSeed(force);
    if (result.skipped) {
      console.log(
        'Seed ya estaba aplicado (usá SEED_FORCE=1 o npm run seed:reset para regenerar)',
      );
      return;
    }
    console.log(result.forced ? 'Seed forzado y regenerado' : 'Seed listo');
    console.log(
      `Admin: ${SEED_ACCOUNTS.admin.email} / ${SEED_ACCOUNTS.admin.password}`,
    );
    console.log(
      `Secretaría: ${SEED_ACCOUNTS.secretaria.email} / ${SEED_ACCOUNTS.secretaria.password}`,
    );
    console.log(
      `Enfermero: ${SEED_ACCOUNTS.enfermero.email} / ${SEED_ACCOUNTS.enfermero.password}`,
    );
    console.log(
      `Médicos: ana.perez, luis.gomez, carla.ruiz, diego.fernandez y elena.soto @turnos.local / ${SEED_ACCOUNTS.medicos.ana.password}`,
    );
    console.log(
      'Cubre: sedes, especialidades, pacientes, profesionales, agendas, turnos, cargos, waitlist, triaje, bitácora, camas, protocolos, internaciones, signos, dosis, insumos y cuentas',
    );
  } finally {
    await disconnectSeed();
  }
}

main().catch(async (err) => {
  console.error(err);
  await disconnectSeed().catch(() => undefined);
  process.exit(1);
});
