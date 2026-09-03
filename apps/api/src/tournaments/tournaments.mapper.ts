import { TournamentModel } from '../generated/prisma/models';
import { TournamentResponseDto } from './dto/tournament-response.dto';

/**
 * Función pura: entidad -> DTO de respuesta, campo por campo y a mano.
 * Mismo criterio que `clubs/clubs.mapper.ts` y `players/players.mapper.ts`:
 * `ClassSerializerInterceptor` con `@Exclude`/`@Expose` es fail-open —un
 * campo nuevo en el schema sale por default hasta que alguien lo excluya—, y
 * acá lo que no puede salir es `clubId`.
 */
export function toTournamentResponse(
  tournament: TournamentModel,
): TournamentResponseDto {
  return {
    id: tournament.id,
    name: tournament.name,
    format: tournament.format,
    status: tournament.status,
    createdAt: tournament.createdAt.toISOString(),
    updatedAt: tournament.updatedAt.toISOString(),
  };
}
