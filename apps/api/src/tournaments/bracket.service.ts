import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { runSerializable } from '../common/prisma/serializable';
import { Prisma } from '../generated/prisma/client';
import {
  MAX_TEAMS,
  MIN_TEAMS,
  PlannedMatch,
  planBracket,
} from '../matches/bracket.builder';
// `import type` obligatorio: `Shuffle` es un alias de tipo y aparece en la
// firma del constructor, que está decorada. Con `emitDecoratorMetadata`, un
// import normal haría que TypeScript intente emitir el tipo como valor.
import type { Shuffle } from '../matches/bracket.builder';
import { PrismaService } from '../prisma/prisma.service';
import { MatchWithTeams, toBracketResponse } from './bracket.mapper';
import { BracketResponseDto } from './dto/bracket-response.dto';
import {
  requireTournamentInScope,
  tournamentNotOpen,
} from './tournaments.service';

/**
 * Token de DI del barajado. Existe para que el sorteo sea reemplazable en los
 * tests sin tocar el service: con `cryptoShuffle` adentro, un test que quiera
 * afirmar dónde cayó una dupla tendría que aceptar cualquier respuesta.
 */
export const BRACKET_SHUFFLE = Symbol('BRACKET_SHUFFLE');

/**
 * Las duplas con sus jugadores, tal como las devuelve la query del cuadro.
 * Es el mismo `select` acotado que usa `TeamsService`: `dni` no se lee, así
 * que no se puede filtrar.
 */
const BRACKET_TEAM_INCLUDE = {
  select: {
    id: true,
    seed: true,
    player1: {
      select: { id: true, firstName: true, lastName: true, category: true },
    },
    player2: {
      select: { id: true, firstName: true, lastName: true, category: true },
    },
  },
} as const;

const MATCH_TEAMS_INCLUDE = {
  teamA: BRACKET_TEAM_INCLUDE,
  teamB: BRACKET_TEAM_INCLUDE,
} as const;

function notEnoughTeams(teamCount: number): ConflictException {
  return new ConflictException({
    code: 'not_enough_teams',
    message: `a bracket needs at least ${MIN_TEAMS} teams`,
    details: { teamCount, minimum: MIN_TEAMS },
  });
}

function tooManyTeams(teamCount: number): ConflictException {
  return new ConflictException({
    code: 'too_many_teams',
    message: `a bracket accepts at most ${MAX_TEAMS} teams`,
    details: { teamCount, maximum: MAX_TEAMS },
  });
}

/**
 * Las cabezas de serie tienen que ser `1..k` sin huecos. Con seeds 1, 2 y 7
 * la posición 3 del cuadro quedaría vacía mientras existe una cabeza 7: es un
 * error del club, no un cuadro que la API deba inventar.
 */
function invalidSeeding(seeds: number[]): ConflictException {
  return new ConflictException({
    code: 'invalid_seeding',
    message:
      'seeds must run from 1 to the number of seeded teams, with no gaps',
    // Los seeds tal como están hoy: el club necesita verlos para saber cuál
    // corregir, y contarlos a mano sobre la lista de duplas es exactamente el
    // trabajo que este error existe para evitar.
    details: { seeds },
  });
}

/** El torneo ya tiene su cuadro: generarlo de nuevo lo destruiría. */
function bracketAlreadyExists(): ConflictException {
  return new ConflictException({
    code: 'bracket_already_exists',
    message: 'the tournament already has a bracket',
  });
}

@Injectable()
export class BracketService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(BRACKET_SHUFFLE) private readonly shuffle: Shuffle,
  ) {}

  /**
   * Genera el cuadro y arranca el torneo. Las dos cosas son **un solo hecho**
   * y por eso van en la misma transacción: un torneo `in_progress` sin
   * bracket, o un bracket con el torneo todavía `open`, son estados que
   * ninguna parte del sistema sabe leer.
   *
   * Corre `Serializable` y no Read Committed porque el alta de duplas también
   * lo hace: si esta transacción fuera más débil, Postgres no tendría cómo
   * detectar el conflicto entre "inscribo una dupla" y "congelo la lista de
   * inscriptos", y el cuadro podría salir sin una dupla que la API ya aceptó.
   */
  async generate(
    clubId: string,
    tournamentId: string,
  ): Promise<BracketResponseDto> {
    return runSerializable(this.prisma, async (tx) => {
      const tournament = await requireTournamentInScope(
        tx,
        clubId,
        tournamentId,
      );

      // `in_progress` se separa del resto porque es el caso que de verdad va
      // a pasar —el club aprieta "generar" dos veces— y merece un error que
      // diga eso y no "el torneo no está abierto para inscripciones".
      if (tournament.status === 'in_progress') {
        throw bracketAlreadyExists();
      }
      if (tournament.status !== 'open') {
        throw tournamentNotOpen();
      }

      // El estado se toma **antes** de leer las duplas, no después: mientras
      // el torneo siga `open`, `TeamsService` acepta inscripciones, y una que
      // entrara entre la lectura y el cierre quedaría fuera de un cuadro que
      // ya se generó. `updateMany` condicionado por `status` es un
      // compare-and-swap: si otro request ganó, actualiza cero filas.
      const claimed = await tx.tournament.updateMany({
        where: { id: tournamentId, clubId, status: 'open' },
        data: { status: 'in_progress' },
      });

      if (claimed.count === 0) {
        throw bracketAlreadyExists();
      }

      const teams = await tx.team.findMany({
        where: { tournamentId, clubId },
        select: { id: true, seed: true },
        // Orden de inscripción (UUIDv7 es time-ordered). No decide nada del
        // cuadro —las no sembradas se sortean— pero deja la entrada del
        // sorteo estable, que es lo que hace reproducible un test con un
        // barajado fijo.
        orderBy: { id: 'asc' },
      });

      if (teams.length < MIN_TEAMS) {
        throw notEnoughTeams(teams.length);
      }
      if (teams.length > MAX_TEAMS) {
        throw tooManyTeams(teams.length);
      }

      const seeded = teams
        .filter(
          (team): team is { id: string; seed: number } => team.seed !== null,
        )
        .sort((a, b) => a.seed - b.seed);

      // `1..k` sin huecos. Alcanza con comparar contra el índice porque la
      // lista ya está ordenada y el índice único `(tournament_id, seed)` ya
      // garantizó que no hay repetidos.
      seeded.forEach((team, index) => {
        if (team.seed !== index + 1) {
          throw invalidSeeding(seeded.map((entry) => entry.seed));
        }
      });

      const plan = planBracket(
        {
          seededTeamIds: seeded.map((team) => team.id),
          unseededTeamIds: teams
            .filter((team) => team.seed === null)
            .map((team) => team.id),
        },
        this.shuffle,
      );

      await this.persist(tx, clubId, tournamentId, plan.matches);

      const stored = await tx.match.findMany({
        where: { tournamentId, clubId },
        orderBy: [{ round: 'asc' }, { position: 'asc' }],
        include: MATCH_TEAMS_INCLUDE,
      });

      return toBracketResponse(tournamentId, stored);
    });
  }

  /**
   * Escribe el árbol **de la final hacia atrás**, una ronda por query.
   *
   * El orden no es una optimización, es lo que hace que se pueda escribir:
   * `next_match_id` es una FK contra `matches`, así que el partido destino
   * tiene que existir cuando se inserta el que lo apunta. Yendo de la última
   * ronda a la primera, cada puntero apunta a algo que ya se insertó en la
   * query anterior.
   *
   * `createManyAndReturn` y no `createMany`: hacen falta los ids recién
   * generados para armar los punteros de la ronda siguiente, y pedirlos con
   * un `findMany` aparte sería una query más por ronda.
   */
  private async persist(
    tx: Prisma.TransactionClient,
    clubId: string,
    tournamentId: string,
    planned: PlannedMatch[],
  ): Promise<void> {
    const roundCount = planned.reduce(
      (highest, match) => Math.max(highest, match.round),
      0,
    );

    // `position` -> `id` de la ronda que ya se escribió, o sea la siguiente.
    let nextRound = new Map<number, string>();

    for (let round = roundCount; round >= 1; round -= 1) {
      const rows = planned
        .filter((match) => match.round === round)
        .map((match) => ({
          clubId,
          tournamentId,
          round: match.round,
          position: match.position,
          teamAId: match.teamAId,
          teamBId: match.teamBId,
          // Un bye nace cerrado: no hay partido que jugar y su ganador es el
          // único lado ocupado. Los tres campos van juntos porque el CHECK
          // `matches_status_outcome` los exige juntos.
          status: match.isBye ? ('finished' as const) : ('pending' as const),
          outcome: match.isBye ? ('bye' as const) : null,
          winnerTeamId: match.isBye ? match.teamAId : null,
          nextMatchId: this.pointerTo(match, nextRound),
          nextSlot: match.nextSlot,
        }));

      const created = await tx.match.createManyAndReturn({
        data: rows,
        select: { id: true, position: true },
      });

      nextRound = new Map(created.map((row) => [row.position, row.id]));
    }
  }

  /**
   * El id del partido al que avanza el ganador. El `throw` no es defensivo
   * por gusto: si el plan trae un `nextPosition` que no existe en la ronda
   * siguiente, insertar igual dejaría `next_match_id` en `null` con
   * `next_slot` cargado, y eso muere contra el CHECK `matches_next_pointer`
   * como un 500 que no dice nada. Fallar acá nombra el problema real.
   */
  private pointerTo(
    match: PlannedMatch,
    nextRound: Map<number, string>,
  ): string | null {
    if (match.nextPosition === null) {
      return null;
    }

    const nextMatchId = nextRound.get(match.nextPosition);
    if (nextMatchId === undefined) {
      throw new Error(
        `bracket plan points round ${match.round} position ${match.position} at a match that was not created`,
      );
    }

    return nextMatchId;
  }
}

export type { MatchWithTeams };
