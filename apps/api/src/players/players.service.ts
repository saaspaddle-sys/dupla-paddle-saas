import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { hashPassword } from '../common/crypto/password';
import { uniqueViolationMentions } from '../common/prisma/unique-violation';
import {
  normalizeCountry,
  normalizeDni,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeText,
} from '../common/transforms/normalize';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizerPlayerDto } from './dto/create-organizer-player.dto';
import {
  ListOrganizerPlayersDto,
  ORGANIZER_PLAYERS_PAGE_SIZE_DEFAULT,
} from './dto/list-organizer-players.dto';
import {
  OrganizerPlayerListResponseDto,
  OrganizerPlayerResponseDto,
} from './dto/organizer-player-response.dto';
import { RegisterPlayerDto } from './dto/register-player.dto';
import { RegisterPlayerResponseDto } from './dto/register-player-response.dto';
import {
  toOrganizerPlayerResponse,
  toRegisterPlayerResponse,
} from './players.mapper';

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

function playerDniExists(): ConflictException {
  return new ConflictException({
    code: 'player_dni_exists',
    message: 'a player profile with that dni already exists',
  });
}

function profileClaimVerificationRequired(): ConflictException {
  return new ConflictException({
    code: 'profile_claim_verification_required',
    message:
      'the existing player profile must be claimed through email verification',
  });
}

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterPlayerDto): Promise<RegisterPlayerResponseDto> {
    const email = normalizeEmail(dto.email);
    const dni = normalizeDni(dto.dni);
    const firstName = normalizeName(dto.firstName);
    const lastName = normalizeName(dto.lastName);
    const category = dto.category ? normalizeText(dto.category) : null;
    const birthDate = dto.birthDate
      ? new Date(`${dto.birthDate}T00:00:00.000Z`)
      : null;
    const country = dto.country ? normalizeCountry(dto.country) : null;
    const province = dto.province ? normalizeText(dto.province) : null;
    const phone = dto.phone ? normalizePhone(dto.phone) : null;
    const emergencyPhone = dto.emergencyPhone
      ? normalizePhone(dto.emergencyPhone)
      : null;

    // El hash de bcrypt es deliberadamente lento; no mantiene abierta la
    // transacción durante ese trabajo de CPU.
    const passwordHash = await hashPassword(dto.password);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingUser = await tx.user.findUnique({ where: { email } });
        if (existingUser) {
          throw emailAlreadyRegistered();
        }

        const existingPlayer = await tx.player.findUnique({ where: { dni } });
        if (existingPlayer) {
          if (existingPlayer.userId !== null) {
            throw dniAlreadyHasAccount();
          }

          // Un DNI no prueba identidad. Todos los perfiles ahora tienen email;
          // un claim futuro debe verificar el control de esa dirección ya
          // guardada, nunca una dirección enviada por quien reclama.
          throw profileClaimVerificationRequired();
        }

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
            dominantHand: dto.dominantHand ?? null,
            country,
            province,
            phone,
            emergencyPhone,
          },
        });
        return toRegisterPlayerResponse(user, player, 'created');
      });
    } catch (error) {
      throw this.toKnownConflict(error) ?? error;
    }
  }

  async listForOrganizer(
    query: ListOrganizerPlayersDto,
  ): Promise<OrganizerPlayerListResponseDto> {
    const limit = query.limit ?? ORGANIZER_PLAYERS_PAGE_SIZE_DEFAULT;
    const normalizedDni = normalizeDni(query.q);
    const dni = /^\d{7,8}$/.test(normalizedDni) ? normalizedDni : undefined;
    const where: Prisma.PlayerWhereInput = {
      OR: [
        { firstName: { contains: query.q, mode: 'insensitive' } },
        { lastName: { contains: query.q, mode: 'insensitive' } },
        ...(dni ? [{ dni }] : []),
      ],
      ...(query.cursor ? { id: { lt: query.cursor } } : {}),
    };
    const players = await this.prisma.player.findMany({
      where,
      orderBy: { id: 'desc' },
      take: limit + 1,
    });
    const hasNextPage = players.length > limit;
    const page = hasNextPage ? players.slice(0, limit) : players;
    const items = page.map(toOrganizerPlayerResponse);

    return {
      items,
      nextCursor: hasNextPage ? items[items.length - 1].id : null,
    };
  }

  async createForOrganizer(
    dto: CreateOrganizerPlayerDto,
  ): Promise<OrganizerPlayerResponseDto> {
    const email = normalizeEmail(dto.email);
    const dni = normalizeDni(dto.dni);
    const firstName = normalizeName(dto.firstName);
    const lastName = normalizeName(dto.lastName);
    const category = dto.category ? normalizeText(dto.category) : null;
    const birthDate = dto.birthDate
      ? new Date(`${dto.birthDate}T00:00:00.000Z`)
      : null;
    const country = dto.country ? normalizeCountry(dto.country) : null;
    const province = dto.province ? normalizeText(dto.province) : null;
    const phone = dto.phone ? normalizePhone(dto.phone) : null;
    const emergencyPhone = dto.emergencyPhone
      ? normalizePhone(dto.emergencyPhone)
      : null;

    try {
      const player = await this.prisma.player.create({
        data: {
          dni,
          firstName,
          lastName,
          email,
          category,
          gender: dto.gender ?? null,
          birthDate,
          dominantHand: dto.dominantHand ?? null,
          country,
          province,
          phone,
          emergencyPhone,
        },
      });
      return toOrganizerPlayerResponse(player);
    } catch (error) {
      if (uniqueViolationMentions(error, 'dni')) {
        throw playerDniExists();
      }
      throw error;
    }
  }

  private toKnownConflict(error: unknown): ConflictException | undefined {
    if (uniqueViolationMentions(error, 'dni')) {
      return dniAlreadyHasAccount();
    }
    if (uniqueViolationMentions(error, 'email')) {
      return emailAlreadyRegistered();
    }
    return undefined;
  }
}
