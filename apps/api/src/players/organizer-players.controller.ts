import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ClubId } from '../auth/decorators/club-id.decorator';
import { ClubScopeGuard } from '../auth/guards/club-scope.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JWT_SECURITY_SCHEME, SWAGGER_TAGS } from '../swagger/swagger.setup';
import { CreateOrganizerPlayerDto } from './dto/create-organizer-player.dto';
import {
  OrganizerPlayerListResponseDto,
  OrganizerPlayerResponseDto,
} from './dto/organizer-player-response.dto';
import { ListOrganizerPlayersDto } from './dto/list-organizer-players.dto';
import { PlayersService } from './players.service';

/**
 * Entradas al directorio global de Player autorizadas por el club. El id del
 * club prueba que quien llama es staff; no se escribe en Player, que sigue
 * siendo un perfil de plataforma.
 */
@ApiTags(SWAGGER_TAGS.players)
@Controller('players')
export class OrganizerPlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get()
  @UseGuards(JwtAuthGuard, ClubScopeGuard)
  @ApiBearerAuth(JWT_SECURITY_SCHEME)
  @ApiOperation({
    summary: 'Busca perfiles globales para inscribirlos desde el club',
  })
  @ApiOkResponse({ type: OrganizerPlayerListResponseDto })
  @ApiBadRequestResponse({ description: 'Query inválida (`validation`).' })
  @ApiUnauthorizedResponse({
    description: 'Sin token o token inválido (`unauthenticated`).',
  })
  @ApiForbiddenResponse({
    description: 'La cuenta no administra ningún club (`club_required`).',
  })
  list(
    @ClubId() clubId: string,
    @Query() query: ListOrganizerPlayersDto,
  ): Promise<OrganizerPlayerListResponseDto> {
    // El decorador es el límite de autorización. No se pasa al service:
    // Player no tiene clubId ni debe adquirirlo por accidente.
    void clubId;
    return this.playersService.listForOrganizer(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard, ClubScopeGuard)
  @ApiBearerAuth(JWT_SECURITY_SCHEME)
  @ApiOperation({ summary: 'Crea un perfil global de jugador desde el club' })
  @ApiCreatedResponse({ type: OrganizerPlayerResponseDto })
  @ApiBadRequestResponse({
    description:
      'Body inválido (`validation`). Email es obligatorio para este flujo.',
  })
  @ApiConflictResponse({
    description: 'Ya existe un perfil con ese DNI (`player_dni_exists`).',
  })
  @ApiUnauthorizedResponse({
    description: 'Sin token o token inválido (`unauthenticated`).',
  })
  @ApiForbiddenResponse({
    description: 'La cuenta no administra ningún club (`club_required`).',
  })
  create(
    @ClubId() clubId: string,
    @Body() dto: CreateOrganizerPlayerDto,
  ): Promise<OrganizerPlayerResponseDto> {
    void clubId;
    return this.playersService.createForOrganizer(dto);
  }
}
