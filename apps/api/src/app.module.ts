import { resolve } from 'node:path';
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AppExceptionFilter } from './common/filters/http-exception.filter';
import { validationExceptionFactory } from './common/pipes/validation-exception.factory';
import { PlayersModule } from './players/players.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    // El .env vive en la raíz del monorepo; los scripts corren con cwd == apps/api.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(process.cwd(), '../../.env'),
    }),
    PrismaModule,
    PlayersModule,
  ],
  providers: [
    // Registrados acá como providers (APP_PIPE/APP_FILTER) y no con
    // app.useGlobalPipes()/useGlobalFilters() en main.ts: los tests e2e
    // levantan AppModule vía @nestjs/testing sin pasar por bootstrap(), así
    // que un wiring en main.ts dejaría los e2e corriendo sin validación ni
    // shape de error — validando un contrato que no es el de producción.
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
        stopAtFirstError: false,
        exceptionFactory: validationExceptionFactory,
      }),
    },
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },
  ],
})
export class AppModule {}
