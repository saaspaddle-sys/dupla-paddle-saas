import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { API_TAGS, JWT_SECURITY_SCHEME } from '../swagger/swagger.setup';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { CurrentUserResponseDto } from './dto/current-user-response.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { toCurrentUserResponse } from './auth.mapper';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedUser } from './types/authenticated-user';

/**
 * De plataforma, no de club: autentica `User`, que es global. Comparte el
 * prefijo `auth` con `RegisterPlayerController` (`players/`) — mismo
 * criterio que ese controller documenta: el prefijo de ruta no tiene que
 * coincidir con el módulo dueño.
 */
@ApiTags(API_TAGS.platform)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  // `@Post` es 201 por default en Nest; acá es 200: no se crea un recurso,
  // se verifica una credencial y se emite un token.
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  // Igual límite y ventana que `POST /auth/register` (ver ese controller):
  // ambos son escritura/verificación pública sin auth, así que ambos
  // necesitan el mismo freno a fuerza bruta y credential stuffing.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary: 'Autentica con email y contraseña, y emite un access token',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({
    description:
      'Email o contraseña incorrectos (`invalid_credentials`). A propósito, el mismo error para ambos casos: no revela si el email existe.',
  })
  @ApiForbiddenResponse({
    description: 'La cuenta está suspendida (`account_suspended`).',
  })
  @ApiTooManyRequestsResponse({
    description: 'Demasiados intentos (`too_many_requests`).',
  })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(JWT_SECURITY_SCHEME)
  @ApiOperation({ summary: 'Devuelve la identidad del usuario autenticado' })
  @ApiOkResponse({ type: CurrentUserResponseDto })
  @ApiUnauthorizedResponse({
    description:
      'Sin token, o token inválido/expirado/de una cuenta suspendida (`unauthenticated`).',
  })
  me(@CurrentUser() user: AuthenticatedUser): CurrentUserResponseDto {
    return toCurrentUserResponse(user);
  }
}
