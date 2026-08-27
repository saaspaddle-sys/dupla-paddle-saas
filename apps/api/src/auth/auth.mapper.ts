import { CurrentUserResponseDto } from './dto/current-user-response.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { AuthenticatedUser } from './types/authenticated-user';

/**
 * Funciones puras entidad -> DTO, a mano — mismo criterio que
 * `players/players.mapper.ts`: nada de `ClassSerializerInterceptor` con
 * `@Exclude`/`@Expose`, que es fail-open ante un campo nuevo en el schema.
 */

export function toLoginResponse(
  accessToken: string,
  expiresInSeconds: number,
): LoginResponseDto {
  return { accessToken, tokenType: 'Bearer', expiresIn: expiresInSeconds };
}

export function toCurrentUserResponse(
  user: AuthenticatedUser,
): CurrentUserResponseDto {
  return {
    id: user.id,
    email: user.email,
    player: user.player
      ? {
          id: user.player.id,
          firstName: user.player.firstName,
          lastName: user.player.lastName,
          category: user.player.category,
          gender: user.player.gender,
        }
      : null,
    club: user.club
      ? {
          id: user.club.id,
          name: user.club.name,
          slug: user.club.slug,
          status: user.club.status,
        }
      : null,
  };
}
