import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { RequestWithClubScope } from '../guards/club-scope.guard';

/**
 * Lee el `club_id` que dejó `ClubScopeGuard`. Es la **única** forma en que
 * un handler de la clase `club` obtiene su scope: si un service lo saca de
 * un DTO, es rechazable en review sin discusión.
 *
 * Podría leer `request.user.club.id` directo, pero entonces cada controller
 * repetiría el chequeo de `null` o pondría un `!`. Que el guard estreche el
 * tipo a `clubId: string` es lo que hace que el controller no pueda
 * equivocarse.
 *
 * Sin el guard adelante tira 500, no 4xx: un controller que se olvidó el
 * guard es un bug de programación, no un error del cliente, y tiene que
 * romper ruidosamente en el primer request.
 */
export const ClubId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<RequestWithClubScope>();

    if (!request.clubId) {
      throw new InternalServerErrorException(
        'ClubId decorator used without ClubScopeGuard',
      );
    }

    return request.clubId;
  },
);
