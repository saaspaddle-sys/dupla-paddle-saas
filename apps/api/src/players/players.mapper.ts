import { PlayerModel, UserModel } from '../generated/prisma/models';
import { RegisterPlayerResponseDto } from './dto/register-player-response.dto';

/**
 * Función pura: entidad -> DTO de respuesta. A propósito no se usa
 * `ClassSerializerInterceptor` con `@Exclude`/`@Expose` sobre las
 * entidades: ese enfoque es fail-open (un campo nuevo en el schema sale
 * por default hasta que alguien lo excluya). Con `dni` en la tabla,
 * fail-open no es una opción — acá cada campo de salida se agrega a mano.
 */
export function toRegisterPlayerResponse(
  user: UserModel,
  player: PlayerModel,
  outcome: 'created' | 'claimed',
): RegisterPlayerResponseDto {
  return {
    outcome,
    user: {
      id: user.id,
      email: user.email,
    },
    player: {
      id: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      category: player.category,
      gender: player.gender,
      createdAt: player.createdAt.toISOString(),
    },
  };
}
