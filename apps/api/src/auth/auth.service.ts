import { randomUUID } from 'node:crypto';
import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS, verifyPassword } from '../common/crypto/password';
import { normalizeEmail } from '../common/transforms/normalize';
import { PrismaService } from '../prisma/prisma.service';
import { toLoginResponse } from './auth.mapper';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';

/** 7 días. Único token, sin refresh (ver `docs/decisions.md`, entrada de sesión). */
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

function invalidCredentials(): UnauthorizedException {
  // Mismo `code` y `message` para "no existe ese email" y "contraseña
  // incorrecta" — a propósito. Si difirieran, el endpoint sería un oráculo
  // de enumeración de emails registrados.
  return new UnauthorizedException({
    code: 'invalid_credentials',
    message: 'invalid email or password',
  });
}

function accountSuspended(): ForbiddenException {
  return new ForbiddenException({
    code: 'account_suspended',
    message: 'this account is suspended',
  });
}

@Injectable()
export class AuthService {
  // Generado una vez en boot con el mismo costo que un hash real (no un
  // literal hardcodeado, que en un diff parece una credencial filtrada).
  // Sirve solo para que `verifyPassword` recorra el mismo camino de bcrypt
  // cuando el email no existe — nunca se usa para autenticar a nadie.
  private readonly dummyHash = bcrypt.hashSync(randomUUID(), BCRYPT_ROUNDS);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Sin usuario: igual se corre bcrypt.compare contra un hash dummy, para
    // que el tiempo de respuesta no delate si el email existe o no.
    const passwordMatches = await verifyPassword(
      dto.password,
      user?.passwordHash ?? this.dummyHash,
    );

    if (!user || !passwordMatches) {
      throw invalidCredentials();
    }

    // Chequeado *después* de validar la contraseña: hacerlo antes
    // convertiría "cuenta suspendida" en otro oráculo (revela que el email
    // existe sin necesidad de acertar la contraseña).
    if (user.status !== 'active') {
      throw accountSuspended();
    }

    // `emailVerifiedAt` no es un gate acá: el repo no manda emails
    // todavía, así que exigir verificación dejaría a todo el mundo afuera.
    const accessToken = await this.jwtService.signAsync({ sub: user.id });
    return toLoginResponse(accessToken, ACCESS_TOKEN_TTL_SECONDS);
  }
}
