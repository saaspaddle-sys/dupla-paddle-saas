import { MatchModel } from '../generated/prisma/models';
import {
  BracketMatchDto,
  BracketResponseDto,
  BracketTeamDto,
} from './dto/bracket-response.dto';
import { TeamPlayerSource } from './teams.mapper';

/**
 * Lo que el mapper necesita de cada dupla del cuadro. Se declara acá en vez
 * de importar `TeamModel` por lo mismo que en `teams.mapper.ts`: así el
 * `select` de la query no puede traer columnas de más sin que el tipo las
 * pida.
 */
export interface BracketTeamSource {
  id: string;
  seed: number | null;
  player1: TeamPlayerSource;
  player2: TeamPlayerSource;
}

/** La fila de `matches` con sus dos duplas ya resueltas. */
export type MatchWithTeams = MatchModel & {
  teamA: BracketTeamSource | null;
  teamB: BracketTeamSource | null;
};

function toBracketTeam(team: BracketTeamSource | null): BracketTeamDto | null {
  if (!team) {
    return null;
  }

  return {
    id: team.id,
    seed: team.seed,
    player1: {
      id: team.player1.id,
      firstName: team.player1.firstName,
      lastName: team.player1.lastName,
      category: team.player1.category,
    },
    player2: {
      id: team.player2.id,
      firstName: team.player2.firstName,
      lastName: team.player2.lastName,
      category: team.player2.category,
    },
  };
}

export function toBracketMatch(match: MatchWithTeams): BracketMatchDto {
  return {
    id: match.id,
    round: match.round,
    position: match.position,
    teamA: toBracketTeam(match.teamA),
    teamB: toBracketTeam(match.teamB),
    winnerTeamId: match.winnerTeamId,
    status: match.status,
    outcome: match.outcome,
    nextMatchId: match.nextMatchId,
    nextSlot: match.nextSlot,
  };
}

/**
 * Función pura: filas -> DTO, campo por campo y a mano, igual que el resto de
 * los mappers del repo. **No sale `clubId`** de ningún lado —ni del cuadro ni
 * de las duplas—, que es lo que va a permitir reusar este shape en la vista
 * pública sin filtrar datos internos del club.
 *
 * Los tres números se derivan de las filas y no se pasan por parámetro: así
 * el `GET` que lea un cuadro ya guardado obtiene exactamente lo mismo que
 * devolvió el `POST` que lo creó, sin recalcular nada por su cuenta.
 */
export function toBracketResponse(
  tournamentId: string,
  matches: MatchWithTeams[],
): BracketResponseDto {
  const roundCount = matches.reduce(
    (highest, match) => Math.max(highest, match.round),
    0,
  );
  const firstRound = matches.filter((match) => match.round === 1);

  return {
    tournamentId,
    // La primera ronda tiene la mitad de las entradas del cuadro.
    bracketSize: firstRound.length * 2,
    roundCount,
    byeCount: firstRound.filter((match) => match.outcome === 'bye').length,
    matches: matches.map(toBracketMatch),
  };
}
