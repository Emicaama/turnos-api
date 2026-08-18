import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SeedService } from './seed/seed.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const result = await app.get(SeedService).run();
  console.log(JSON.stringify(result));
  await app.close();
}

void bootstrap();
