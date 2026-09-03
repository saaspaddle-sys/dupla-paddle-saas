import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { runSerializable } from '../common/prisma/serializable';
import { normalizeUuid } from '../common/transforms/normalize';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { TeamResponseDto } from './dto/team-response.dto';
import { toTeamResponse } from './teams.mapper';
import {
  requireTournamentInScope,
  tournamentNotOpen,
} from './tournaments.service';

/**
 * Las únicas cuatro columnas de `players` que salen por la API en este
 * módulo. Es un `select` y no un `include` pelado a propósito: con `include`,
 * `dni` viaja de Postgres a Node en cada listado de inscriptos aunque el
 * mapper después no lo copie. Un dato que no se lee no se puede filtrar.
 */
const PLAYER_SUMMARY_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  category: true,
} as const;

/** Los dos `include` de este módulo traen exactamente lo mismo. */
const TEAM_PLAYERS_INCLUDE = {
  player1: { select: PLAYER_SUMMARY_SELECT },
  player2: { select: PLAYER_SUMMARY_SELECT },
} as const;

function playerNotFound(playerIds: string[]): NotFoundException {
  return new NotFoundException({
    code: 'player_not_found',
    message: 'one or both players do not exist',
    // Cuál de los dos falta: sin esto el cliente tiene que adivinar si el id
    // malo es el que tipeó o el que eligió de la lista.
    details: { playerIds },
  });
}

function playerAlreadyRegistered(playerIds: string[]): ConflictException {
  return new ConflictException({
    code: 'player_already_registered',
    message: 'a player is already registered in this tournament',
    details: { playerIds },
  });
}

function duplicateTeam(): ConflictException {
  return new ConflictException({
    code: 'duplicate_team',
    message: 'this team is already registered in the tournament',
  });
}

function teamNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'team_not_found',
    message: 'the team does not exist in this tournament',
  });
}

/**
 * Ordena el par como lo exige el CHECK de la base (`player1_id <
 * player2_id`). Ese orden canónico es lo que hace que el índice único
 * `(tournament_id, player1_id, player2_id)` sirva de algo: sin él, (A, B) y
 * (B, A) son dos filas distintas para Postgres y la misma dupla para
 * cualquier persona.
 *
 * Compara strings, no `uuid`, así que **normaliza a minúscula primero**: el
 * orden de `uuid` en Postgres es el de sus 16 bytes y solo coincide con el
 * orden de strings de JavaScript cuando los dos lados están en minúscula. Con
 * un id en mayúscula el orden se da vuelta ('F' es 70 y 'a' es 97) y el
 * INSERT moriría contra el CHECK como 500. `CreateTeamDto` ya normaliza, y
 * esto lo sostiene igual para cualquier otro entry point que no pase por ese
 * DTO — `normalizeUuid` es idempotente, así que reaplicarlo no cuesta nada.
 */
export function canonicalPair(a: string, b: string): [string, string] {
  const first = normalizeUuid(a);
  const second = normalizeUuid(b);
  return first < second ? [first, second] : [second, first];
}

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Todo el alta corre en una transacción `Serializable`, y no por gusto:
   * entre "este jugador no está inscripto" y el INSERT hay una ventana en la
   * que otro request puede inscribirlo con otra pareja. El índice único
   * atrapa el duplicado exacto de la dupla, pero **no** el caso real —el
   * mismo jugador en dos duplas distintas del mismo torneo—, porque ahí no
   * hay ninguna fila repetida. Ese invariante solo lo sostiene el nivel de
   * aislamiento.
   *
   * `clubId` se escribe desde el torneo ya cargado, nunca desde el body: es
   * lo que hace que la FK compuesta `(tournament_id, club_id)` no pueda
   * fallar, y que la copia denormalizada de `teams.club_id` no mienta.
   */
  async create(
    clubId: string,
    tournamentId: string,
    dto: CreateTeamDto,
  ): Promise<TeamResponseDto> {
    // Se ordena antes de tocar la base para que todas las comparaciones de
    // abajo (el choque, el duplicado, el INSERT) hablen del mismo par.
    // `CreateTeamDto` ya garantizó que son distintos.
    const [player1Id, player2Id] = canonicalPair(dto.player1Id, dto.player2Id);
    const pair = [player1Id, player2Id];

    try {
      const team = await runSerializable(this.prisma, async (tx) => {
        const tournament = await requireTournamentInScope(
          tx,
          clubId,
          tournamentId,
        );

        // Solo `open` acepta inscriptos. Un torneo `in_progress` ya tiene la
        // llave armada y sumar una dupla la invalidaría.
        if (tournament.status !== 'open') {
          throw tournamentNotOpen();
        }

        // Existencia antes del INSERT: sin esto, un id inventado sale como
        // violación de FK (P2003), o sea un 500, cuando en realidad es un
        // error del cliente.
        const players = await tx.player.findMany({
          where: { id: { in: pair } },
          select: { id: true },
        });
        const existing = new Set(players.map((player) => player.id));
        const missing = pair.filter((id) => !existing.has(id));
        if (missing.length > 0) {
          throw playerNotFound(missing);
        }

        // Un jugador juega en una sola dupla por torneo. Se busca por las dos
        // columnas porque el par entrante puede aparecer de cualquier lado de
        // una fila existente.
        const clash = await tx.team.findFirst({
          where: {
            tournamentId: tournament.id,
            OR: [{ player1Id: { in: pair } }, { player2Id: { in: pair } }],
          },
          select: { player1Id: true, player2Id: true },
        });

        if (clash) {
          // Si la fila que choca es exactamente el mismo par, el error
          // específico es el duplicado: decir "un jugador ya está inscripto"
          // mandaría al cliente a buscar un problema que no tiene.
          if (clash.player1Id === player1Id && clash.player2Id === player2Id) {
            throw duplicateTeam();
          }
          throw playerAlreadyRegistered(
            pair.filter(
              (id) => id === clash.player1Id || id === clash.player2Id,
            ),
          );
        }

        return tx.team.create({
          data: {
            clubId: tournament.clubId,
            tournamentId: tournament.id,
            player1Id,
            player2Id,
          },
          include: TEAM_PLAYERS_INCLUDE,
        });
      });

      return toTeamResponse(team);
    } catch (error) {
      throw this.toKnownConflict(error) ?? error;
    }
  }

  /**
   * **Sin paginación, y es deliberado**: un torneo de pádel se juega con
   * decenas de duplas, no con miles — el formato es una llave de eliminación
   * directa, que tiene un techo práctico impuesto por las canchas y el fin de
   * semana. Paginar acá obligaría al frontend a rearmar la lista completa
   * para dibujar el bracket, que es lo único que se hace con ella. Si algún
   * día un formato admite inscripción masiva, se agrega cursor igual que en
   * `GET /tournaments` — envolver un array en `{ items, nextCursor }` sí
   * sería un cambio incompatible, así que ese día nace un endpoint nuevo.
   *
   * Ordenado por `id asc` = orden de inscripción (UUIDv7 es time-ordered).
   */
  async listByTournament(
    clubId: string,
    tournamentId: string,
  ): Promise<TeamResponseDto[]> {
    // Primero el scope: un torneo de otro club tiene que dar 404 antes de
    // que este endpoint diga nada sobre sus inscriptos, ni siquiera "está
    // vacío".
    await requireTournamentInScope(this.prisma, clubId, tournamentId);

    const teams = await this.prisma.team.findMany({
      where: { tournamentId, clubId },
      orderBy: { id: 'asc' },
      include: TEAM_PLAYERS_INCLUDE,
    });

    return teams.map(toTeamResponse);
  }

  /**
   * Borrado real y no un soft delete: una inscripción cancelada antes de que
   * arranque el torneo no tiene valor histórico —el torneo todavía no
   * existió— y una columna `deleted_at` obligaría a filtrarla en cada query
   * futura del bracket. El día que haya que auditar bajas, el evento va a un
   * log de auditoría, no a la tabla del dominio.
   */
  async remove(
    clubId: string,
    tournamentId: string,
    teamId: string,
  ): Promise<void> {
    const tournament = await requireTournamentInScope(
      this.prisma,
      clubId,
      tournamentId,
    );

    if (tournament.status !== 'open') {
      throw tournamentNotOpen();
    }

    // `deleteMany` y no `delete`: el `where` lleva las tres condiciones
    // (dupla, torneo y club) en la misma sentencia, así que una dupla de otro
    // torneo no se borra ni por carrera. `delete` obligaría a leer primero y
    // comparar en Node, que es la ventana que este endpoint no necesita
    // tener.
    const deleted = await this.prisma.team.deleteMany({
      where: { id: teamId, tournamentId, clubId },
    });

    if (deleted.count === 0) {
      throw teamNotFound();
    }
  }

  /**
   * Los chequeos previos dan el mensaje correcto en el caso normal, pero no
   * son la garantía. El índice único
   * `(tournament_id, player1_id, player2_id)` lo es, y este es el fallback
   * que mapea su violación (P2002) al mismo 409 que ya tira el camino
   * normal, por si dos inscripciones idénticas ganan la carrera. Mismo patrón
   * que `ClubsService` y `PlayersService`.
   */
  private toKnownConflict(error: unknown): ConflictException | undefined {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return undefined;
    }

    const target = this.constraintTarget(error.meta);
    // Sirve tanto si Prisma reporta los nombres de campo (`player1Id`) como
    // el nombre del constraint
    // (`teams_tournament_id_player1_id_player2_id_key`), que es lo que
    // devuelve el driver adapter.
    if (target.some((field) => field.toLowerCase().includes('player1'))) {
      return duplicateTeam();
    }
    // Un target que no reconocemos no se disfraza de 409: se deja subir como
    // 500, que es lo que realmente es.
    return undefined;
  }

  private constraintTarget(meta: unknown): string[] {
    const target = (meta as { target?: unknown } | undefined)?.target;
    if (Array.isArray(target)) {
      return target.filter(
        (value): value is string => typeof value === 'string',
      );
    }
    return typeof target === 'string' ? [target] : [];
  }
}
