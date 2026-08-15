import { ConflictException, Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import {
  normalizeDni,
  normalizeEmail,
  normalizeName,
  normalizeText,
} from '../common/transforms/normalize';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterPlayerDto } from './dto/register-player.dto';
import { RegisterPlayerResponseDto } from './dto/register-player-response.dto';
import { toRegisterPlayerResponse } from './players.mapper';

// bcryptjs es puro JS (sin build nativo), a costa de ser más lento que
// bcrypt/argon2 nativos — elegido para no depender de builds nativos
// distintos entre Windows local y Linux en CI.
const BCRYPT_ROUNDS = 10;

function emailAlreadyRegistered(): ConflictException {
  return new ConflictException({
    code: 'email_registered',
    message: 'an account with that email already exists',
  });
}

function dniAlreadyHasAccount(): ConflictException {
  return new ConflictException({
    code: 'dni_has_account',
    message: 'the dni is already linked to an account',
  });
}

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterPlayerDto): Promise<RegisterPlayerResponseDto> {
    // El DTO ya llega normalizado por los @Transform, pero se reaplica acá
    // (son idempotentes) para sostener el invariante si el service se
    // llama desde otro entry point que no pase por el DTO — p. ej. el
    // alta por el organizador, en un slice futuro. Los campos del DTO ya
    // están tipados como `string`, así que no hace falta castear.
    const email = normalizeEmail(dto.email);
    const dni = normalizeDni(dto.dni);
    const firstName = normalizeName(dto.firstName);
    const lastName = normalizeName(dto.lastName);
    const category = dto.category ? normalizeText(dto.category) : null;
    const birthDate = dto.birthDate
      ? new Date(`${dto.birthDate}T00:00:00.000Z`)
      : null;

    // No mantener la transacción abierta durante ~100ms de hashing.
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingUser = await tx.user.findUnique({ where: { email } });
        if (existingUser) {
          throw emailAlreadyRegistered();
        }

        const existingPlayer = await tx.player.findUnique({ where: { dni } });

        if (!existingPlayer) {
          const user = await tx.user.create({ data: { email, passwordHash } });
          const player = await tx.player.create({
            data: {
              userId: user.id,
              dni,
              firstName,
              lastName,
              email,
              category,
              gender: dto.gender ?? null,
              birthDate,
            },
          });
          return toRegisterPlayerResponse(user, player, 'created');
        }

        if (existingPlayer.userId !== null) {
          throw dniAlreadyHasAccount();
        }

        const user = await tx.user.create({ data: { email, passwordHash } });

        // *Claim*: el perfil existe sin dueño (lo cargó un club). Guarda
        // condicional en el WHERE, no un `update` liso — dos claims
        // concurrentes con el mismo DNI usan `user_id` DISTINTOS, así que
        // el índice único de `players.user_id` no los frena. Bajo Read
        // Committed, el segundo UPDATE espera el commit del primero,
        // reevalúa la condición y no afecta ninguna fila.
        //
        // Merge: solo se completan campos vacíos del perfil existente.
        // `firstName`/`lastName` son NOT NULL y nunca se pisan — si el
        // club cargó un nombre distinto, se corrige desde la edición de
        // perfil (slice futuro), no en el registro de otra persona.
        const [claimedPlayer] = await tx.player.updateManyAndReturn({
          where: { id: existingPlayer.id, userId: null },
          data: {
            userId: user.id,
            email: existingPlayer.email ?? email,
            category: existingPlayer.category ?? category,
            gender: existingPlayer.gender ?? dto.gender ?? null,
            birthDate: existingPlayer.birthDate ?? birthDate,
          },
        });

        if (!claimedPlayer) {
          // El SELECT de arriba vio el perfil libre, pero perdió la carrera
          // contra otro claim entre el findUnique y este update.
          throw dniAlreadyHasAccount();
        }

        return toRegisterPlayerResponse(user, claimedPlayer, 'claimed');
      });
    } catch (error) {
      throw this.toKnownConflict(error) ?? error;
    }
  }

  /**
   * El SELECT previo (`findUnique`) da el mensaje correcto en el caso
   * normal, pero no es la garantía: dos registros simultáneos con el
   * mismo DNI o email pasan igual el chequeo. El índice único es la
   * garantía real, y este es el fallback que mapea su violación (P2002)
   * al mismo 409 que ya tira el camino normal.
   */
  private toKnownConflict(error: unknown): ConflictException | undefined {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return undefined;
    }

    const target = this.constraintTarget(error.meta);
    if (target.some((field) => field.includes('dni'))) {
      return dniAlreadyHasAccount();
    }
    if (target.some((field) => field.includes('email'))) {
      return emailAlreadyRegistered();
    }
    // Un target que no reconocemos no se disfraza de 409: se deja subir
    // como 500, que es lo que realmente es.
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
