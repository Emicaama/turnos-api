import { NestFactory } from '@nestjs/core';
import { SEED_ACCOUNTS, SeedService } from './seed/seed.service';
import { SeedModule } from './seed/seed.module';

async function main() {
  const app = await NestFactory.createApplicationContext(SeedModule);
  try {
    const result = await app.get(SeedService).run();
    if (result.skipped) {
      console.log('Seed ya estaba aplicado');
      return;
    }
    console.log('Seed listo');
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
      '20 turnos del lunes 9 al viernes 13 de noviembre de 2026, uno por paciente (ART)',
    );
    console.log(
      'Cama 101 libre, 204 ocupada (Gael Torres, cirugía), 205 en limpieza, 310 bloqueada',
    );
    console.log(
      'Cargos de consulta en tres coberturas. Cuenta de internación: Suero fisiológico $800',
    );
  } finally {
    await app.close();
  }
}

void main();
