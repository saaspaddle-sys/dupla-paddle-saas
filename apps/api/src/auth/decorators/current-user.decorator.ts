import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../types/authenticated-user';

interface RequestWithUser {
  user: AuthenticatedUser;
}

/**
 * Lee `request.user`, que `JwtAuthGuard` deja puesto (vía `JwtStrategy.validate`).
 * Solo tiene sentido detrás de `@UseGuards(JwtAuthGuard)` — sin el guard,
 * `request.user` no existe y esto tira en runtime, no en compilación.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
