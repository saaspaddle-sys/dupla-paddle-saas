import { TeamModel } from '../generated/prisma/models';
import { PlayerSummaryDto, TeamResponseDto } from './dto/team-response.dto';

/**
 * Lo que el mapper necesita de cada jugador. Se declara acá y no se importa
 * `PlayerModel` a propósito: así el `select` de la query no puede traer
 * `dni` "de más" sin que el tipo lo pida, y el día que alguien cambie ese
 * `select` por un `include` pelado, el compilador no lo bendice en silencio.
 */
export interface TeamPlayerSource {
  id: string;
  firstName: string;
  lastName: string;
  category: string | null;
}

/** La fila de `teams` con sus dos jugadores ya resueltos. */
export type TeamWithPlayers = TeamModel & {
  player1: TeamPlayerSource;
  player2: TeamPlayerSource;
};

function toPlayerSummary(player: TeamPlayerSource): PlayerSummaryDto {
  return {
    id: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    category: player.category,
  };
}

/**
 * Función pura: entidad -> DTO de respuesta, campo por campo y a mano. Igual
 * que el resto de los mappers del repo, y acá con más razón: lo que no puede
 * salir es el `dni` del jugador.
 */
export function toTeamResponse(team: TeamWithPlayers): TeamResponseDto {
  return {
    id: team.id,
    tournamentId: team.tournamentId,
    player1: toPlayerSummary(team.player1),
    player2: toPlayerSummary(team.player2),
    createdAt: team.createdAt.toISOString(),
  };
}
