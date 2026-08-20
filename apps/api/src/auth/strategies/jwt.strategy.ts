import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../types/authenticated-user';

export interface JwtPayload {
  sub: string;
}

function unauthenticated(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'unauthenticated',
    message: 'the access token is invalid or expired',
  });
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    // Los tipos de `passport-jwt` son laxos (constructor `(...args: any[])`
    // del mixin de Passport); tipar `options` como `StrategyOptions` acá,
    // antes de pasarlo a `super`, es lo que evita que `no-unsafe-argument`
    // (warning local, error en CI) se dispare.
    const options: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    };
    super(options);
  }

  /**
   * Una sola query por request, la misma que hace falta para chequear
   * `status`: la DB es la fuente de verdad de a quién pertenece este
   * token, nunca el token mismo — el JWT solo lleva `sub` (ver
   * `docs/decisions.md`, entrada de sesión, que matiza el "viajan en el
   * JWT" de la de 2026-07-23). Un usuario suspendido o borrado pierde el
   * acceso al instante, sin esperar a que venza el token.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        status: true,
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            category: true,
            gender: true,
          },
        },
      },
    });

    if (!user || user.status !== 'active') {
      throw unauthenticated();
    }

    return { id: user.id, email: user.email, player: user.player };
  }
}
