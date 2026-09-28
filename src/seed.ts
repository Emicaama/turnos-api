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
      `Médicos: ${SEED_ACCOUNTS.medicos.ana.email} y ${SEED_ACCOUNTS.medicos.luis.email} / ${SEED_ACCOUNTS.medicos.ana.password}`,
    );
    console.log(
      '3 turnos el lunes 2026-10-05: Ana 09:00 y 10:00, Luis 11:00 (ART)',
    );
  } finally {
    await app.close();
  }
}

void main();
