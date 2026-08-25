import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { normalizeName } from '../common/transforms/normalize';
import {
  RESERVED_SLUGS,
  SLUG_MAX_LENGTH,
  slugify,
} from '../common/transforms/slug';
import { Prisma } from '../generated/prisma/client';
import { SubscriptionPlan } from '../generated/prisma/enums';
import { SubscriptionModel } from '../generated/prisma/models';
import { PrismaService } from '../prisma/prisma.service';
import { toClubResponse } from './clubs.mapper';
import { ClubResponseDto } from './dto/club-response.dto';
import { CreateClubDto } from './dto/create-club.dto';
import { UpdateClubDto } from './dto/update-club.dto';

/**
 * Cuota de torneos por plan: **llaves activas simultáneas**, no acumuladas
 * ni por período (`docs/decisions.md`). Se copia a
 * `subscriptions.max_tournaments` al crear la suscripción y no se relee de
 * acá: mientras el cobro sea manual hace falta poder dar una excepción a
 * una cuenta puntual sin inventar un plan nuevo.
 */
export const PLAN_MAX_TOURNAMENTS: Record<SubscriptionPlan, number> = {
  basic: 3,
  pro: 12,
};

/** Toda suscripción nace acá; el cambio de plan es manual. */
export const DEFAULT_PLAN: SubscriptionPlan = 'basic';

/**
 * Cuántos slugs derivados se prueban antes de rendirse: el original más
 * `-2`, `-3`, `-4` y `-5`. Acotado a propósito — un `while` contra un
 * índice único es una forma conocida de colgar un request.
 */
const SLUG_DERIVATION_ATTEMPTS = 5;

/**
 * Para un nombre que no deja ningún carácter ASCII alfanumérico (p. ej.
 * íntegramente en un alfabeto que `NFD` no descompone). El sufijado se
 * encarga de que igual sea único.
 */
const FALLBACK_SLUG_BASE = 'club';

function clubLimitReached(): ConflictException {
  return new ConflictException({
    code: 'club_limit_reached',
    message: 'this account already owns a club',
  });
}

/**
 * Hoy solo lo puede disparar la derivación al agotar sus intentos, porque
 * el cliente no elige el slug. El `code` ya existe para cuando sí lo elija.
 */
function slugTaken(): ConflictException {
  return new ConflictException({
    code: 'slug_taken',
    message: 'could not derive an available slug from the club name',
  });
}

/**
 * `[base, base-2, ..., base-5]`, sacando los que pisen un segmento de ruta
 * reservado. Un club llamado "Me" deriva `me`, que ambiguaría
 * `GET /clubs/me` el día que exista `GET /clubs/:slug`: se descarta ese
 * candidato y se sigue con `me-2`.
 *
 * El sufijo se recorta contra `SLUG_MAX_LENGTH` — `slugify` ya dejó la base
 * en el límite, así que concatenar sin recortar produciría slugs de 52
 * caracteres, que el DTO rechazaría si alguien los volviera a mandar.
 */
export function buildSlugCandidates(base: string): string[] {
  const candidates = [base];

  for (let suffix = 2; suffix <= SLUG_DERIVATION_ATTEMPTS; suffix += 1) {
    const tail = `-${suffix}`;
    const head = base
      .slice(0, SLUG_MAX_LENGTH - tail.length)
      .replace(/-+$/, '');
    candidates.push(`${head}${tail}`);
  }

  return candidates.filter((candidate) => !RESERVED_SLUGS.includes(candidate));
}

@Injectable()
export class ClubsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `ownerId` sale de `@CurrentUser().id`, nunca del body — `CreateClubDto`
   * ni siquiera declara `ownerId`, así que `forbidNonWhitelisted` convierte
   * cualquier intento en `400 validation`.
   */
  async create(ownerId: string, dto: CreateClubDto): Promise<ClubResponseDto> {
    // El DTO ya llega normalizado por los `@Transform`, pero se reaplica acá
    // (es idempotente) para sostener el invariante si el service se llama
    // desde otro entry point que no pase por el DTO. Mismo criterio que
    // `PlayersService.register`.
    const name = normalizeName(dto.name);

    // Chequeo de cuota. **No** es la garantía: dos `POST /clubs`
    // concurrentes de la misma cuenta pasan los dos bajo Read Committed. Lo
    // que los serializa es el índice único de `subscriptions.user_id`, que
    // la segunda transacción viola — ver `toKnownConflict`. Este SELECT
    // existe solo para dar el mensaje correcto en el caso sin carrera.
    const existing = await this.prisma.subscription.findUnique({
      where: { userId: ownerId },
      select: { id: true },
    });
    if (existing) {
      throw clubLimitReached();
    }

    const slug = await this.deriveSlug(name);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // La suscripción primero: su índice único es la puerta de la cuota,
        // así que una segunda transacción concurrente choca antes de
        // insertar nada más.
        const subscription = await tx.subscription.create({
          data: {
            userId: ownerId,
            plan: DEFAULT_PLAN,
            maxTournaments: PLAN_MAX_TOURNAMENTS[DEFAULT_PLAN],
          },
        });

        const club = await tx.club.create({ data: { ownerId, name, slug } });

        return toClubResponse(club, subscription);
      });
    } catch (error) {
      throw this.toKnownConflict(error) ?? error;
    }
  }

  /** El `clubId` viene de `@ClubId()`, o sea del usuario autenticado. */
  async findByClubId(clubId: string): Promise<ClubResponseDto> {
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      // `select` sobre `owner` y no `include`: traer el `User` entero
      // metería `password_hash` en memoria para nada.
      include: { owner: { select: { subscription: true } } },
    });

    if (!club) {
      // `ClubScopeGuard` ya resolvió que esta cuenta tiene club, así que
      // llegar acá significa que desapareció entre el auth y el handler. No
      // hay endpoint que borre clubes: es corrupción, no un 404.
      throw new InternalServerErrorException(
        `club ${clubId} resolved by the guard but missing from the database`,
      );
    }

    return toClubResponse(club, requireSubscription(club.owner.subscription));
  }

  async update(clubId: string, dto: UpdateClubDto): Promise<ClubResponseDto> {
    // Body vacío: se devuelve la representación actual sin escribir. Un
    // `update` con `data: {}` igual tocaría `updated_at` por el `@updatedAt`
    // del schema, o sea que un no-op del cliente mentiría en la respuesta.
    if (dto.name === undefined) {
      return this.findByClubId(clubId);
    }

    const club = await this.prisma.club.update({
      where: { id: clubId },
      data: { name: normalizeName(dto.name) },
      include: { owner: { select: { subscription: true } } },
    });

    return toClubResponse(club, requireSubscription(club.owner.subscription));
  }

  /**
   * El slug siempre lo deriva el server desde el nombre — ver
   * `CreateClubDto` para por qué el cliente no lo elige. Un alta que se cae
   * porque otro club se llama parecido es fricción evitable en el primer
   * minuto de uso, así que se sufija en vez de rechazar.
   *
   * El SELECT de candidatos no es la garantía —el índice único de
   * `clubs.slug` lo es—, pero una carrera acá exige dos altas del mismo
   * nombre en el mismo instante, y el resultado es un `409 slug_taken`
   * honesto.
   */
  private async deriveSlug(name: string): Promise<string> {
    const candidates = buildSlugCandidates(slugify(name) || FALLBACK_SLUG_BASE);

    const taken = await this.prisma.club.findMany({
      where: { slug: { in: candidates } },
      select: { slug: true },
    });
    const takenSlugs = new Set(taken.map((club) => club.slug));

    const free = candidates.find((candidate) => !takenSlugs.has(candidate));
    if (!free) {
      throw slugTaken();
    }

    return free;
  }

  /**
   * El SELECT previo da el mensaje correcto en el caso normal, pero no es
   * la garantía. El índice único lo es, y este es el fallback que mapea su
   * violación (P2002) al mismo 409 que ya tira el camino normal. Mismo
   * patrón que `PlayersService`.
   */
  private toKnownConflict(error: unknown): ConflictException | undefined {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return undefined;
    }

    const target = this.constraintTarget(error.meta);
    if (target.some((field) => field.includes('slug'))) {
      return slugTaken();
    }
    // `subscriptions_user_id_key`: la cuenta ya tiene suscripción, o sea que
    // ya tiene club. Es el cupo, no un choque de identidad.
    if (target.some((field) => field.includes('user_id'))) {
      return clubLimitReached();
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

/**
 * Todo club nace con su suscripción en la misma transacción. Si falta, la
 * fila se insertó por afuera: se deja subir el 500 en vez de devolver
 * `subscription: null`, que obligaría a todo el frontend a manejar un
 * estado que no existe y escondería una corrupción real.
 */
function requireSubscription(
  subscription: SubscriptionModel | null,
): SubscriptionModel {
  if (!subscription) {
    throw new InternalServerErrorException(
      'club without subscription: the create transaction invariant is broken',
    );
  }
  return subscription;
}
