import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { API_TAGS } from '../swagger/swagger.setup';
import { RegisterPlayerDto } from './dto/register-player.dto';
import { RegisterPlayerResponseDto } from './dto/register-player-response.dto';
import { PlayersService } from './players.service';

/**
 * Ruta `/auth/register` con módulo dueño `PlayersModule`, no `AuthModule`:
 * la operación escribe perfil + credenciales en una sola transacción de
 * Prisma, y `AuthModule` (login, /auth/me, JwtStrategy) es sesión, sin
 * lógica en común con esto. El prefijo de ruta no tiene que coincidir con
 * el dominio del módulo que la declara.
 */
// Endpoint de plataforma: sin auth, sin club_id (Player no lo tiene), así que
// tampoco lleva @ApiBearerAuth.
@ApiTags(API_TAGS.platform)
@Controller('auth')
export class RegisterPlayerController {
  constructor(private readonly playersService: PlayersService) {}

  @Post('register')
  @UseGuards(ThrottlerGuard)
  // Mismo límite y ventana que `POST /auth/login` (ver ese controller):
  // escritura pública sin auth, con el mismo riesgo de fuerza bruta /
  // oráculo de DNIs (`docs/decisions.md`, entrada de dedup de jugadores).
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary: 'Registra un jugador y su cuenta, deduplicando por DNI',
  })
  @ApiCreatedResponse({ type: RegisterPlayerResponseDto })
  @ApiConflictResponse({
    description:
      'El email ya tiene cuenta (`email_registered`), o el DNI ya está asociado a una (`dni_has_account`).',
  })
  @ApiTooManyRequestsResponse({
    description: 'Demasiados intentos (`too_many_requests`).',
  })
  register(@Body() dto: RegisterPlayerDto): Promise<RegisterPlayerResponseDto> {
    return this.playersService.register(dto);
  }
}
