import { ClubModel, SubscriptionModel } from '../generated/prisma/models';
import { ClubResponseDto } from './dto/club-response.dto';

/**
 * Función pura: entidad -> DTO de respuesta, campo por campo y a mano.
 * Mismo criterio que `players/players.mapper.ts`: `ClassSerializerInterceptor`
 * con `@Exclude`/`@Expose` es fail-open (un campo nuevo en el schema sale
 * por default hasta que alguien lo excluya), y acá lo que no puede salir es
 * `ownerId`.
 *
 * La suscripción llega como parámetro aparte y no desde `club`: en el
 * modelo cuelga del `User` dueño, no del club.
 */
export function toClubResponse(
  club: ClubModel,
  subscription: SubscriptionModel,
): ClubResponseDto {
  return {
    id: club.id,
    name: club.name,
    slug: club.slug,
    status: club.status,
    createdAt: club.createdAt.toISOString(),
    updatedAt: club.updatedAt.toISOString(),
    subscription: {
      plan: subscription.plan,
      status: subscription.status,
      maxTournaments: subscription.maxTournaments,
    },
  };
}
