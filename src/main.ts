import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { setupApp } from './setup-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);

  const swagger = new DocumentBuilder()
    .setTitle('Turnos API')
    .setDescription('Control de turnos por secretaría')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

void bootstrap();
