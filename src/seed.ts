import { NestFactory } from '@nestjs/core';
import { SEED_ACCOUNTS, SeedService } from './seed/seed.service';
import { SeedModule } from './seed/seed.module';

async function main() {
  const force = process.env.SEED_FORCE === '1';
  const app = await NestFactory.createApplicationContext(SeedModule);
  try {
    const result = await app.get(SeedService).run(force);
    if (result.skipped) {
      console.log('Seed ya estaba aplicado (usá SEED_FORCE=1 para regenerar todo)');
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
      'Cubre: sedes, especialidades, pacientes, profesionales, agendas, turnos (hoy±), cargos, lista de espera, triaje, bitácora, alas/camas, protocolos, internaciones, signos, prescripciones, dosis, insumos y cuentas',
    );
  } finally {
    await app.close();
  }
}

void main();
