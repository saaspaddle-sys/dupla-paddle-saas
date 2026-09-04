import { resolve } from 'node:path';
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { ClubsModule } from './clubs/clubs.module';
import { AppExceptionFilter } from './common/filters/http-exception.filter';
import { validationExceptionFactory } from './common/pipes/validation-exception.factory';
import { HealthModule } from './health/health.module';
import { PlayersModule } from './players/players.module';
import { PrismaModule } from './prisma/prisma.module';
import { TournamentsModule } from './tournaments/tournaments.module';

@Module({
  imports: [
    // El .env vive en la raíz del monorepo; los scripts corren con cwd == apps/api.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(process.cwd(), '../../.env'),
    }),
    // Global (lo marca así el propio ThrottlerModule), pero sin registrar
    // `ThrottlerGuard` como `APP_GUARD`: `GET /health` es un readiness
    // probe y no se throttlea. Se aplica por controller con `@UseGuards`
    // — ver `auth/auth.controller.ts` y `players/register-player.controller.ts`.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
    PrismaModule,
    HealthModule,
    PlayersModule,
    AuthModule,
    // La lista se lee como orden de dependencia (Prisma -> Health ->
    // Players -> Auth -> Clubs -> Tournaments); en Nest el orden no es
    // funcional.
    ClubsModule,
    TournamentsModule,
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
