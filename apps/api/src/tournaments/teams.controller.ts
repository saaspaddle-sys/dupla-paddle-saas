import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ClubId } from '../auth/decorators/club-id.decorator';
import { ClubScopeGuard } from '../auth/guards/club-scope.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { API_TAGS, JWT_SECURITY_SCHEME } from '../swagger/swagger.setup';
import { CreateTeamDto } from './dto/create-team.dto';
import { TeamParamsDto } from './dto/team-params.dto';
import { TeamResponseDto } from './dto/team-response.dto';
import { TournamentParamsDto } from './dto/tournament-params.dto';
import { TeamsService } from './teams.service';

/**
 * Sub-recurso de torneo: la dupla **es** la inscripción, no hay tabla
 * aparte. Controller propio y no tres handlers más en `TournamentsController`
 * porque son otro recurso con su propio ciclo de vida; el módulo sigue siendo
 * uno solo (`TournamentsModule`).
 *
 * Un solo nivel de anidamiento, como pide `docs/api-conventions.md`. El
 * `club_id` no aparece en la ruta: sale del usuario autenticado, y el
 * `tournamentId` del path se valida siempre contra ese club antes de tocar
 * nada.
 */
@ApiTags(API_TAGS.club)
@Controller('tournaments/:tournamentId/teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, ClubScopeGuard)
  @ApiBearerAuth(JWT_SECURITY_SCHEME)
  @ApiOperation({ summary: 'Inscribe una dupla en un torneo abierto' })
  @ApiCreatedResponse({ type: TeamResponseDto })
  @ApiBadRequestResponse({
    description:
      'Body inválido (`validation`). Incluye el caso de mandar dos veces el mismo jugador.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Sin token, o token inválido/expirado/de una cuenta suspendida (`unauthenticated`).',
  })
  @ApiForbiddenResponse({
    description: 'La cuenta no administra ningún club (`club_required`).',
  })
  @ApiNotFoundResponse({
    description:
      'El torneo no existe o es de otro club (`tournament_not_found`), o alguno de los jugadores no existe (`player_not_found`; `details.playerIds` dice cuál).',
  })
  @ApiConflictResponse({
    description:
      'El torneo no está abierto (`tournament_not_open`), alguno de los jugadores ya juega en otra dupla del torneo (`player_already_registered`; `details.playerIds` dice cuál), o esta misma dupla ya está inscripta (`duplicate_team`).',
  })
  create(
    @ClubId() clubId: string,
    @Param() params: TournamentParamsDto,
    @Body() dto: CreateTeamDto,
  ): Promise<TeamResponseDto> {
    return this.teamsService.create(clubId, params.tournamentId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, ClubScopeGuard)
  @ApiBearerAuth(JWT_SECURITY_SCHEME)
  @ApiOperation({
    summary:
      'Lista las duplas inscriptas en el torneo, en orden de inscripción. Sin paginación: la lista es acotada por naturaleza (una llave de eliminación directa) y el frontend la necesita entera para dibujar el bracket.',
  })
  @ApiOkResponse({ type: TeamResponseDto, isArray: true })
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
  list(
    @ClubId() clubId: string,
    @Param() params: TournamentParamsDto,
  ): Promise<TeamResponseDto[]> {
    return this.teamsService.listByTournament(clubId, params.tournamentId);
  }

  @Delete(':teamId')
  @UseGuards(JwtAuthGuard, ClubScopeGuard)
  // El default de Nest para DELETE es 200; acá no hay cuerpo que devolver —
  // la representación borrada no le sirve a nadie y el cliente ya tiene el id.
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth(JWT_SECURITY_SCHEME)
  @ApiOperation({
    summary: 'Da de baja una dupla de un torneo abierto (borrado real)',
  })
  @ApiNoContentResponse({ description: 'La dupla se borró. Sin cuerpo.' })
  @ApiUnauthorizedResponse({
    description:
      'Sin token, o token inválido/expirado/de una cuenta suspendida (`unauthenticated`).',
  })
  @ApiForbiddenResponse({
    description: 'La cuenta no administra ningún club (`club_required`).',
  })
  @ApiNotFoundResponse({
    description:
      'El torneo no existe o es de otro club (`tournament_not_found`), o la dupla no existe en ese torneo (`team_not_found`).',
  })
  @ApiConflictResponse({
    description:
      'El torneo ya no está abierto (`tournament_not_open`): con la llave armada, una baja la invalidaría.',
  })
  remove(
    @ClubId() clubId: string,
    @Param() params: TeamParamsDto,
  ): Promise<void> {
    return this.teamsService.remove(clubId, params.tournamentId, params.teamId);
  }
}
