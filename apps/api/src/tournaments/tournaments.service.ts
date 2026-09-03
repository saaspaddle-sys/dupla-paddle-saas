import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { runSerializable } from '../common/prisma/serializable';
import { normalizeName } from '../common/transforms/normalize';
import { Prisma } from '../generated/prisma/client';
import { TournamentStatus } from '../generated/prisma/enums';
import { TournamentModel } from '../generated/prisma/models';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import {
  ListTournamentsDto,
  TOURNAMENTS_PAGE_SIZE_DEFAULT,
} from './dto/list-tournaments.dto';
import { TournamentListResponseDto } from './dto/tournament-list-response.dto';
import { TournamentResponseDto } from './dto/tournament-response.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { toTournamentResponse } from './tournaments.mapper';

/**
 * Los estados que ocupan cupo. La cuota cuenta llaves **activas
 * simultáneas**, no acumuladas ni por período (`docs/decisions.md`), así que
 * un torneo `finished` o `canceled` libera su lugar.
 */
const ACTIVE_TOURNAMENT_STATUSES: TournamentStatus[] = ['open', 'in_progress'];

/**
 * Transiciones que este slice acepta por `PATCH`. Cancelar es la única, y
 * eso es deliberado: `in_progress` lo va a poner el arranque del torneo
 * (cuando se genere la llave) y `finished` el cierre del último partido.
 * Ninguno de los dos es un cambio que el cliente pueda pedir a mano sin que
 * el bracket quede inconsistente, así que hasta que existan esos endpoints
 * pedirlos es un 409.
 *
 * Un `Record` completo sobre el enum y no un `Partial`: cuando
 * `TournamentStatus` gane un valor, TypeScript obliga a decidir qué sale de
 * ese estado en vez de dejarlo caer en un `undefined` en runtime.
 */
const ALLOWED_STATUS_TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> =
  {
    open: ['canceled'],
    in_progress: ['canceled'],
    finished: [],
    canceled: [],
  };

/**
 * Un torneo que no existe y uno de otro club devuelven **lo mismo**. Un 403
 * confirmaría que el id existe, que es justamente el dato que un club no
 * tiene que poder sacarle a otro (invariante de tenancy).
 */
export function tournamentNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'tournament_not_found',
    message: 'the tournament does not exist',
  });
}

/** El torneo existe y es del club, pero ya no acepta cambios de inscriptos. */
export function tournamentNotOpen(): ConflictException {
  return new ConflictException({
    code: 'tournament_not_open',
    message: 'the tournament is not open for registrations',
  });
}

function tournamentQuotaReached(
  max: number,
  current: number,
): ConflictException {
  return new ConflictException({
    code: 'tournament_quota_reached',
    message: 'the subscription does not allow more active tournaments',
    // `max` y `current` para que la UI diga "3 de 3" sin pedir la
    // suscripción aparte. No se filtra nada del dueño ni del plan.
    details: { max, current },
  });
}

function invalidStatusTransition(
  from: TournamentStatus,
  to: TournamentStatus,
): ConflictException {
  return new ConflictException({
    code: 'invalid_status_transition',
    message: `a tournament cannot go from ${from} to ${to}`,
    details: { from, to },
  });
}

/**
 * Busca el torneo **dentro del scope del club** o tira 404. El `clubId`
 * viaja en el `where` y no se compara después de leer: es la diferencia
 * entre no encontrarlo y encontrarlo y decidir no mostrarlo.
 *
 * Toma el cliente por parámetro para servir igual dentro y fuera de una
 * transacción — `PrismaService` es asignable a `Prisma.TransactionClient`.
 */
export async function requireTournamentInScope(
  client: Prisma.TransactionClient,
  clubId: string,
  tournamentId: string,
): Promise<TournamentModel> {
  const tournament = await client.tournament.findFirst({
    where: { id: tournamentId, clubId },
  });

  if (!tournament) {
    throw tournamentNotFound();
  }

  return tournament;
}

@Injectable()
export class TournamentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * El `clubId` viene de `@ClubId()`, o sea del usuario autenticado, y es el
   * que se escribe en la fila. `CreateTournamentDto` ni siquiera declara
   * `clubId`, así que `forbidNonWhitelisted` convierte cualquier intento de
   * mandarlo en `400 validation`.
   *
   * Todo corre en una transacción `Serializable` porque el chequeo de cuota
   * es un read-modify-write: bajo Read Committed, dos `POST /tournaments`
   * concurrentes del mismo club leen el mismo `count` y los dos insertan,
   * dejando al club un torneo por encima de su plan. Acá no hay índice único
   * que sirva de red —la cuota es un conteo, no una identidad—, así que el
   * nivel de aislamiento *es* la garantía: Postgres aborta una de las dos con
   * 40001 y `runSerializable` la reintenta contra el estado ya actualizado.
   */
  async create(
    clubId: string,
    dto: CreateTournamentDto,
  ): Promise<TournamentResponseDto> {
    // El DTO ya llegó normalizado por su `@Transform`; se reaplica acá (es
    // idempotente) para sostener el invariante si el service se llama desde
    // otro entry point. Mismo criterio que `ClubsService.create`.
    const name = normalizeName(dto.name);

    const tournament = await runSerializable(this.prisma, async (tx) => {
      // La suscripción se lee **dentro** de la transacción y no antes: leerla
      // afuera la dejaría fuera del snapshot serializable, que es lo único
      // que hace que el conteo de abajo signifique algo.
      const club = await tx.club.findUnique({
        where: { id: clubId },
        select: {
          // La cuota vive en la suscripción del **dueño**, no del club: un
          // dueño con varios clubes (post-MVP) tiene una sola que los cubre a
          // todos. `select` anidado y no dos queries — y sin traer el `User`
          // entero, que metería `password_hash` en memoria para nada.
          owner: {
            select: { subscription: { select: { maxTournaments: true } } },
          },
        },
      });

      if (!club) {
        // `ClubScopeGuard` ya resolvió que esta cuenta tiene club, así que
        // llegar acá significa que desapareció entre el auth y el handler.
        // No hay endpoint que borre clubes: es corrupción, no un 404.
        throw new InternalServerErrorException(
          `club ${clubId} resolved by the guard but missing from the database`,
        );
      }

      const subscription = club.owner.subscription;
      if (!subscription) {
        // Todo club nace con su suscripción en la misma transacción
        // (`ClubsService.create`). Sin ella no hay cuota que aplicar, y
        // asumir un default silencioso sería regalar torneos ilimitados.
        throw new InternalServerErrorException(
          'club without subscription: the create transaction invariant is broken',
        );
      }

      const current = await tx.tournament.count({
        where: { clubId, status: { in: ACTIVE_TOURNAMENT_STATUSES } },
      });

      if (current >= subscription.maxTournaments) {
        throw tournamentQuotaReached(subscription.maxTournaments, current);
      }

      // Sin `status` ni `format`: los dos los pone el default de la columna
      // (`open` y `single_elimination`).
      return tx.tournament.create({ data: { clubId, name } });
    });

    return toTournamentResponse(tournament);
  }

  /**
   * Paginación por cursor sobre `id desc`. `id` es UUIDv7, que es
   * time-ordered: ordenar por él es ordenar por fecha de creación sin
   * agregar `createdAt` al índice ni arrastrar el empate entre dos torneos
   * creados en el mismo milisegundo.
   *
   * Se piden `limit + 1` filas para saber si hay página siguiente sin
   * contar la tabla entera; la de más se descarta y nunca sale en `items`.
   */
  async list(
    clubId: string,
    query: ListTournamentsDto,
  ): Promise<TournamentListResponseDto> {
    const limit = query.limit ?? TOURNAMENTS_PAGE_SIZE_DEFAULT;

    const rows = await this.prisma.tournament.findMany({
      where: {
        clubId,
        ...(query.status === undefined ? {} : { status: query.status }),
        // Estrictamente menor: el cursor es el último item ya entregado, así
        // que incluirlo repetiría una fila en cada página.
        ...(query.cursor === undefined ? {} : { id: { lt: query.cursor } }),
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];

    return {
      items: items.map(toTournamentResponse),
      // `null` y no el id del último cuando no hay más: así el cliente corta
      // sin tener que pedir una página vacía para descubrirlo.
      nextCursor: hasMore && last ? last.id : null,
    };
  }

  async findOne(
    clubId: string,
    tournamentId: string,
  ): Promise<TournamentResponseDto> {
    const tournament = await requireTournamentInScope(
      this.prisma,
      clubId,
      tournamentId,
    );

    return toTournamentResponse(tournament);
  }

  /**
   * Renombrar y cambiar de estado son independientes: cualquiera de los dos,
   * los dos, o ninguno. Renombrar está permitido en cualquier estado —el
   * nombre es una etiqueta, no parte de la máquina de estados—, así que un
   * torneo `finished` mal escrito se puede corregir.
   *
   * Body vacío: se devuelve la representación actual sin escribir, igual que
   * `PATCH /clubs/me`. Un `update` con `data: {}` igual tocaría `updated_at`
   * por el `@updatedAt` del schema, o sea que un no-op del cliente mentiría
   * en la respuesta.
   */
  async update(
    clubId: string,
    tournamentId: string,
    dto: UpdateTournamentDto,
  ): Promise<TournamentResponseDto> {
    const tournament = await requireTournamentInScope(
      this.prisma,
      clubId,
      tournamentId,
    );

    if (dto.name === undefined && dto.status === undefined) {
      return toTournamentResponse(tournament);
    }

    if (dto.status !== undefined) {
      // Pedir el estado que el torneo ya tiene también es un 409: "quedarse
      // quieto" no está en la tabla de transiciones, y aceptarlo en silencio
      // escondería un cliente que cree estar cambiando algo.
      if (!ALLOWED_STATUS_TRANSITIONS[tournament.status].includes(dto.status)) {
        throw invalidStatusTransition(tournament.status, dto.status);
      }
    }

    // Sin transacción: el `where` por `id` ya está dentro del scope y el
    // único race posible son dos cancelaciones simultáneas, que convergen al
    // mismo estado. Cuando existan `in_progress` y `finished` como
    // transiciones reales, esto pasa a ser un `updateMany` condicionado por
    // el estado leído.
    const updated = await this.prisma.tournament.update({
      where: { id: tournament.id },
      data: {
        ...(dto.name === undefined ? {} : { name: normalizeName(dto.name) }),
        ...(dto.status === undefined ? {} : { status: dto.status }),
      },
    });

    return toTournamentResponse(updated);
  }
}
