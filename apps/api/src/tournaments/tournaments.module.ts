import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';

/**
 * `teams` no tiene módulo propio: es un sub-recurso de torneo (`/tournaments/
 * :tournamentId/teams`) y su regla central —que el torneo sea del club y esté
 * `open`— es del torneo, no de la dupla. Separarlo obligaría a exportar
 * `requireTournamentInScope` a través de un límite de módulo para que
 * `TeamsService` la use, que es peor que la cercanía que evita. El día que la
 * inscripción gane vida propia (lista de espera, pagos, confirmación del
 * jugador), nace `src/registrations/` y consume `TournamentsService` por
 * `exports` — cambio aditivo.
 *
 * `AuthModule` se importa por `PassportModule`, que es lo que `AuthModule`
 * exporta: sin eso, el `AuthGuard('jwt')` de `JwtAuthGuard` no encuentra la
 * estrategia registrada. No hay ciclo — `AuthModule` no importa este módulo.
 *
 * **No** importa `ClubsModule`: la cuota se lee dentro de la transacción
 * `Serializable` de `TournamentsService.create`, con el mismo `tx` que hace
 * el conteo y el INSERT. Pasar ese handle a través de un límite de módulo
 * (`ClubsService.getQuota(tx, ...)`) rompería el encapsulamiento sin comprar
 * nada, y leer la cuota afuera de la transacción la dejaría fuera del
 * snapshot serializable — que es justamente lo que hace que el chequeo valga.
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TournamentsController, TeamsController],
  providers: [TournamentsService, TeamsService],
})
export class TournamentsModule {}
