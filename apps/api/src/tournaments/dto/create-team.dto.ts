import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsUUID } from 'class-validator';
import { normalizeUuidInput } from '../../common/transforms/normalize';
import { IsDifferentFrom } from '../../common/validators/is-different-from.validator';

/**
 * Sin `clubId` ni `tournamentId`: el club sale de `@ClubId()` y el torneo del
 * path. El `club_id` que se escribe en la fila se toma del torneo ya cargado
 * — nunca del body, que es lo que sostiene la FK compuesta
 * `(tournament_id, club_id)`.
 *
 * El par se guarda en orden canónico (`player1_id < player2_id`, CHECK en la
 * base), así que el orden que manda el cliente no se conserva: es lo que hace
 * que (A, B) y (B, A) sean la misma dupla para el índice único y no dos
 * inscripciones. La respuesta devuelve el par ya ordenado.
 *
 * Los dos ids se pasan a minúscula antes de validar. El orden canónico se
 * calcula en Node comparando strings, pero el `CHECK` que lo hace cumplir
 * compara `uuid` nativo, y los dos órdenes solo coinciden en minúscula: un id
 * en mayúscula ordenaría al revés ('F' es 70 y 'a' es 97) y el INSERT moriría
 * contra el constraint como 500. Normalizar antes de validar además hace que
 * `IsDifferentFrom` compare el mismo id escrito distinto como lo que es —el
 * mismo jugador— en vez de dejarlo pasar como dos.
 */
export class CreateTeamDto {
  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }: { value: unknown }) => normalizeUuidInput(value))
  @IsUUID('all', { message: 'player1Id must be a valid player id' })
  player1Id!: string;

  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }: { value: unknown }) => normalizeUuidInput(value))
  @IsUUID('all', { message: 'player2Id must be a valid player id' })
  // Se valida acá y no contra el CHECK de la base: `player1_id < player2_id`
  // solo sabe fallar como 500, y "te inscribiste dos veces al mismo jugador"
  // es un error del cliente que merece decir qué campo está mal.
  @IsDifferentFrom('player1Id', {
    message: 'player2Id must be different from player1Id',
  })
  player2Id!: string;
}
