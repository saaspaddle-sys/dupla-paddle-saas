import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ClubId } from '../auth/decorators/club-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClubScopeGuard } from '../auth/guards/club-scope.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { API_TAGS, JWT_SECURITY_SCHEME } from '../swagger/swagger.setup';
import { ClubsService } from './clubs.service';
import { ClubResponseDto } from './dto/club-response.dto';
import { CreateClubDto } from './dto/create-club.dto';
import { UpdateClubDto } from './dto/update-club.dto';

/**
 * Clase `club`, pero **sin** `ClubScopeGuard` a nivel controller: `POST
 * /clubs` es el endpoint que crea el scope y todavía no tiene `club_id` que
 * resolver. Los otros dos lo declaran por handler.
 *
 * `me` es un segmento literal, no un identificador: el club se resuelve
 * desde el usuario autenticado, que es la forma de cumplir "el `club_id`
 * nunca aparece en la ruta" sin caer en un `/club` singular. Si algún día
 * entra un `GET /clubs/:slug` público, tiene que declararse **después** de
 * `@Get('me')` o el parámetro se come la ruta literal — la lista de slugs
 * reservados (`common/transforms/slug.ts`) es la segunda mitad de esa
 * defensa.
 */
@ApiTags(API_TAGS.club)
@Controller('clubs')
export class ClubsController {
  constructor(private readonly clubsService: ClubsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  // Mismo límite y ventana que `/auth/login` y `/auth/register`. Es una
  // operación que una cuenta hace una sola vez en su vida; 5/min por IP es
  // holgado y evita que un token válido martille el camino del 409 con una
  // query por request. El tracker es por IP y en memoria (heredado).
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiBearerAuth(JWT_SECURITY_SCHEME)
  @ApiOperation({
    summary: 'Crea el club de la cuenta autenticada y su suscripción',
  })
  @ApiCreatedResponse({ type: ClubResponseDto })
  @ApiUnauthorizedResponse({
    description:
      'Sin token, o token inválido/expirado/de una cuenta suspendida (`unauthenticated`).',
  })
  @ApiConflictResponse({
    description:
      'La cuenta ya tiene un club (`club_limit_reached`), o el server no pudo derivar un slug libre desde el nombre (`slug_taken`).',
  })
  @ApiTooManyRequestsResponse({
    description: 'Demasiados intentos (`too_many_requests`).',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateClubDto,
  ): Promise<ClubResponseDto> {
    return this.clubsService.create(user.id, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, ClubScopeGuard)
  @ApiBearerAuth(JWT_SECURITY_SCHEME)
  @ApiOperation({
    summary: 'Devuelve el club de la cuenta autenticada con su suscripción',
  })
  @ApiOkResponse({ type: ClubResponseDto })
  @ApiUnauthorizedResponse({
    description:
      'Sin token, o token inválido/expirado/de una cuenta suspendida (`unauthenticated`).',
  })
  @ApiForbiddenResponse({
    description: 'La cuenta no administra ningún club (`club_required`).',
  })
  findMine(@ClubId() clubId: string): Promise<ClubResponseDto> {
    return this.clubsService.findByClubId(clubId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard, ClubScopeGuard)
  @ApiBearerAuth(JWT_SECURITY_SCHEME)
  @ApiOperation({ summary: 'Actualiza los datos editables del club propio' })
  @ApiOkResponse({ type: ClubResponseDto })
  @ApiUnauthorizedResponse({
    description:
      'Sin token, o token inválido/expirado/de una cuenta suspendida (`unauthenticated`).',
  })
  @ApiForbiddenResponse({
    description: 'La cuenta no administra ningún club (`club_required`).',
  })
  update(
    @ClubId() clubId: string,
    @Body() dto: UpdateClubDto,
  ): Promise<ClubResponseDto> {
    return this.clubsService.update(clubId, dto);
  }
}
