import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Se declara inline igual que `RequestWithUser` en
 * `decorators/current-user.decorator.ts`: es la forma del request en este
 * punto de la cadena, no un tipo de dominio que valga exportar.
 */
export interface RequestWithClubScope {
  user?: AuthenticatedUser;
  clubId?: string;
}

/**
 * El guard de tenancy. Resuelve el `club_id` **desde el usuario
 * autenticado** y lo deja en `request.clubId`, que es de donde lo lee
 * `@ClubId()`. Nunca mira el body, los params ni la query — que es el
 * invariante entero (`CLAUDE.md` raíz).
 *
 * Síncrono y sin tocar la DB: `JwtStrategy.validate` ya resolvió el club
 * en la misma query que de todos modos hace por request para chequear
 * `User.status`.
 *
 * **Nunca se registra como `APP_GUARD`**: mataría `/health`, la vista
 * pública y `/auth/*`. Se aplica por controller o por handler.
 */
@Injectable()
export class ClubScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithClubScope>();

    // No es paranoia decorativa: es el caso "alguien puso ClubScopeGuard
    // sin JwtAuthGuard adelante". Falla cerrado con 401 en vez de dejar
    // pasar un request sin scope.
    if (!request.user) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'the access token is invalid or expired',
      });
    }

    if (!request.user.club) {
      throw new ForbiddenException({
        code: 'club_required',
        message: 'the authenticated account does not own a club',
      });
    }

    request.clubId = request.user.club.id;
    return true;
  }
}
