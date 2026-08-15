import { Body, Controller, Post } from '@nestjs/common';
import { RegisterPlayerDto } from './dto/register-player.dto';
import { RegisterPlayerResponseDto } from './dto/register-player-response.dto';
import { PlayersService } from './players.service';

/**
 * Ruta `/auth/register` con módulo dueño `PlayersModule`, no `AuthModule`:
 * la operación escribe perfil + credenciales en una sola transacción de
 * Prisma, y el `AuthModule` del PR siguiente es de sesión (login, /auth/me,
 * JwtStrategy), sin lógica en común con esto. El prefijo de ruta no tiene
 * que coincidir con el dominio del módulo que la declara.
 */
@Controller('auth')
export class RegisterPlayerController {
  constructor(private readonly playersService: PlayersService) {}

  // Endpoint de plataforma: sin auth, sin club_id (Player no lo tiene).
  @Post('register')
  register(@Body() dto: RegisterPlayerDto): Promise<RegisterPlayerResponseDto> {
    return this.playersService.register(dto);
  }
}
