import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger/swagger.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  // Antes de listen(): monta rutas (`/docs`, `/docs/json`) sobre la app.
  const swaggerPath = setupSwagger(app);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  if (swaggerPath !== null) {
    Logger.log(`Swagger: http://localhost:${port}/${swaggerPath}`, 'Bootstrap');
  }
}
void bootstrap();
