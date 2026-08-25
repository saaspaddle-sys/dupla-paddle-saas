import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ClubsController } from './clubs.controller';
import { ClubsService } from './clubs.service';

/**
 * `subscriptions` no tiene módulo propio: vive dentro de `ClubsService` y
 * no expone rutas. La suscripción se crea en la misma transacción de Prisma
 * que el club, y separarla obligaría a pasar el handle `tx` a través del
 * límite de módulo (`SubscriptionsService.create(tx, ...)`), que es peor
 * que la duplicación que evita. Cuando entre Mercado Pago y la suscripción
 * gane endpoints propios, nace `src/subscriptions/` y `ClubsService` la
 * consume por `exports` — cambio aditivo.
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
  // Lo necesita el slice de torneos para leer `maxTournaments` al validar
  // la cuota, y la regla de módulos prohíbe importar clases internas de
  // otro módulo.
  exports: [ClubsService],
})
export class ClubsModule {}
