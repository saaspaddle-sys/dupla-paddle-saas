import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ClubsController } from './clubs.controller';
import { ClubsService } from './clubs.service';

/**
 * `ClubsService` conserva únicamente la creación de la suscripción gratuita:
 * ocurre en la misma transacción de Prisma que el club y moverla obligaría a
 * filtrar el handle `tx` a través del límite de módulo. El ciclo de vida de
 * billing y sus rutas viven por separado en `SubscriptionsModule`.
 *
 * `AuthModule` se importa por `PassportModule`, que es lo que `AuthModule`
 * ya exporta con este caso escrito en su comentario. No hay ciclo:
 * `AuthModule` no importa `ClubsModule` — `JwtStrategy` consulta Prisma
 * directo, igual que ya hace con `player`.
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ClubsController],
  providers: [ClubsService],
  // Public service boundary for consumers that need club operations. Billing
  // and tournament quota checks use their own transactional boundaries.
  exports: [ClubsService],
})
export class ClubsModule {}
