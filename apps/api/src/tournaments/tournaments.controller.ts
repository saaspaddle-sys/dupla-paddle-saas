import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ClubId } from '../auth/decorators/club-id.decorator';
import { ClubScopeGuard } from '../auth/guards/club-scope.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { API_TAGS, JWT_SECURITY_SCHEME } from '../swagger/swagger.setup';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { ListTournamentsDto } from './dto/list-tournaments.dto';
import { TournamentListResponseDto } from './dto/tournament-list-response.dto';
import { TournamentParamsDto } from './dto/tournament-params.dto';
import { TournamentResponseDto } from './dto/tournament-response.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { TournamentsService } from './tournaments.service';

/**
 * Clase `club`: los cuatro handlers llevan `JwtAuthGuard` + `ClubScopeGuard`
 * y reciben el scope por `@ClubId()`. Los guards se declaran por handler y no
 * a nivel de clase, igual que en `ClubsController` — así agregar un endpoint
 * público a este controller (la vista de torneos para jugadores, más
 * adelante) es una decisión explícita y no algo que se hereda sin querer.
 *
 * El `club_id` no aparece en ninguna ruta: sale del usuario autenticado.
 */
@ApiTags(API_TAGS.club)
@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, ClubScopeGuard, ThrottlerGuard)
  // Mismo límite y ventana que `POST /clubs`: el alta de un torneo es una
  // operación de a una por vez para un humano, y 5/min por IP es holgado. Lo
  // que evita es que un token válido martille el camino de la cuota, que es
  // una transacción `Serializable` por request. El tracker es por IP y en
  // memoria (heredado del `ThrottlerModule` global).
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiBearerAuth(JWT_SECURITY_SCHEME)
  @ApiOperation({ summary: 'Crea un torneo en el club de la cuenta' })
  @ApiCreatedResponse({ type: TournamentResponseDto })
  @ApiUnauthorizedResponse({
    description:
      'Sin token, o token inválido/expirado/de una cuenta suspendida (`unauthenticated`).',
  })
  @ApiForbiddenResponse({
    description: 'La cuenta no administra ningún club (`club_required`).',
  })
  @ApiConflictResponse({
    description:
      'El club ya usa toda su cuota de torneos activos (`tournament_quota_reached`; `details` trae `max` y `current`).',
  })
  @ApiTooManyRequestsResponse({
    description: 'Demasiados intentos (`too_many_requests`).',
  })
  create(
    @ClubId() clubId: string,
    @Body() dto: CreateTournamentDto,
  ): Promise<TournamentResponseDto> {
    return this.tournamentsService.create(clubId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, ClubScopeGuard)
  @ApiBearerAuth(JWT_SECURITY_SCHEME)
  @ApiOperation({
    summary:
      'Lista los torneos del club, del más nuevo al más viejo, paginados por cursor',
  })
  @ApiOkResponse({ type: TournamentListResponseDto })
  @ApiUnauthorizedResponse({
    description:
      'Sin token, o token inválido/expirado/de una cuenta suspendida (`unauthenticated`).',
  })
  @ApiForbiddenResponse({
    description: 'La cuenta no administra ningún club (`club_required`).',
  })
  list(
    @ClubId() clubId: string,
    @Query() query: ListTournamentsDto,
  ): Promise<TournamentListResponseDto> {
    return this.tournamentsService.list(clubId, query);
  }

  @Get(':tournamentId')
  @UseGuards(JwtAuthGuard, ClubScopeGuard)
  @ApiBearerAuth(JWT_SECURITY_SCHEME)
  @ApiOperation({ summary: 'Devuelve un torneo del club' })
  @ApiOkResponse({ type: TournamentResponseDto })
  @ApiUnauthorizedResponse({
    description:
      'Sin token, o token inválido/expirado/de una cuenta suspendida (`unauthenticated`).',
  })
  @ApiForbiddenResponse({
    description: 'La cuenta no administra ningún club (`club_required`).',
  })
  @ApiNotFoundResponse({
    description:
      'El torneo no existe **o es de otro club** (`tournament_not_found`) — los dos casos son indistinguibles a propósito.',
  })
  findOne(
    @ClubId() clubId: string,
    @Param() params: TournamentParamsDto,
  ): Promise<TournamentResponseDto> {
    return this.tournamentsService.findOne(clubId, params.tournamentId);
  }

  @Patch(':tournamentId')
  @UseGuards(JwtAuthGuard, ClubScopeGuard)
  @ApiBearerAuth(JWT_SECURITY_SCHEME)
  @ApiOperation({
    summary:
      'Renombra el torneo y/o cambia su estado (en este slice, solo cancelarlo)',
  })
  @ApiOkResponse({ type: TournamentResponseDto })
  @ApiUnauthorizedResponse({
    description:
      'Sin token, o token inválido/expirado/de una cuenta suspendida (`unauthenticated`).',
  })
  @ApiForbiddenResponse({
    description: 'La cuenta no administra ningún club (`club_required`).',
  })
  @ApiNotFoundResponse({
    description:
      'El torneo no existe o es de otro club (`tournament_not_found`).',
  })
  @ApiConflictResponse({
    description:
      'El cambio de estado pedido no está permitido (`invalid_status_transition`; `details` trae `from` y `to`). Este slice solo acepta `open -> canceled` e `in_progress -> canceled`.',
  })
  update(
    @ClubId() clubId: string,
    @Param() params: TournamentParamsDto,
    @Body() dto: UpdateTournamentDto,
  ): Promise<TournamentResponseDto> {
    return this.tournamentsService.update(clubId, params.tournamentId, dto);
  }
}
