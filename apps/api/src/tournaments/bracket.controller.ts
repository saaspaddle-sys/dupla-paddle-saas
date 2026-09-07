import {
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
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ClubId } from '../auth/decorators/club-id.decorator';
import { ClubScopeGuard } from '../auth/guards/club-scope.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { API_TAGS, JWT_SECURITY_SCHEME } from '../swagger/swagger.setup';
import { BracketService } from './bracket.service';
import { BracketResponseDto } from './dto/bracket-response.dto';
import { TournamentParamsDto } from './dto/tournament-params.dto';

/**
 * **`bracket` en singular, y es una excepción consciente** a la regla de
 * sustantivos en plural de `docs/api-conventions.md`. Un torneo tiene
 * exactamente un cuadro: `/brackets` prometería una colección que nunca va a
 * tener dos elementos, y dejaría el `DELETE` sin destino salvo inventando un
 * id que el cliente no necesita. Es el mismo criterio por el que `me` y
 * `/health` están reconocidos ahí como excepciones en vez de leerse como
 * deuda.
 *
 * Controller propio y no un handler más en `TeamsController`: el cuadro es
 * otro recurso. Vive en `TournamentsModule` por lo mismo que `teams` —su
 * regla central es del torneo (que sea del club, que esté `open`) y necesita
 * `requireTournamentInScope`, que separarlo obligaría a exportar a través de
 * un límite de módulo.
 */
@ApiTags(API_TAGS.club)
@Controller('tournaments/:tournamentId/bracket')
export class BracketController {
  constructor(private readonly bracketService: BracketService) {}

  @Get()
  @UseGuards(JwtAuthGuard, ClubScopeGuard)
  @ApiBearerAuth(JWT_SECURITY_SCHEME)
  @ApiOperation({ summary: 'Consulta el cuadro persistido del torneo.' })
  @ApiOkResponse({ type: BracketResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Sin sesión válida (`unauthenticated`).',
  })
  @ApiForbiddenResponse({
    description: 'La cuenta no administra un club (`club_required`).',
  })
  @ApiNotFoundResponse({
    description:
      'Torneo inexistente o de otro club (`tournament_not_found`), o sin cuadro (`bracket_not_found`).',
  })
  findOne(
    @ClubId() clubId: string,
    @Param() params: TournamentParamsDto,
  ): Promise<BracketResponseDto> {
    return this.bracketService.findOne(clubId, params.tournamentId);
  }

  @Delete()
  @UseGuards(JwtAuthGuard, ClubScopeGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth(JWT_SECURITY_SCHEME)
  @ApiOperation({
    summary:
      'Borra el cuadro sin resultados y reabre la inscripción. Los byes automáticos no impiden borrarlo.',
  })
  @ApiNoContentResponse({ description: 'Cuadro eliminado y torneo abierto.' })
  @ApiUnauthorizedResponse({
    description: 'Sin sesión válida (`unauthenticated`).',
  })
  @ApiForbiddenResponse({
    description: 'La cuenta no administra un club (`club_required`).',
  })
  @ApiNotFoundResponse({
    description:
      'Torneo inexistente o de otro club (`tournament_not_found`), o sin cuadro (`bracket_not_found`).',
  })
  @ApiConflictResponse({
    description:
      'El torneo no está en curso (`tournament_not_in_progress`) o el cuadro tiene resultados o sets cargados (`bracket_has_results`).',
  })
  remove(
    @ClubId() clubId: string,
    @Param() params: TournamentParamsDto,
  ): Promise<void> {
    return this.bracketService.remove(clubId, params.tournamentId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, ClubScopeGuard)
  // 201 y no 200: la llamada crea un recurso que antes no existía. Es el
  // default de Nest para POST y se deja explícito para que se lea al lado de
  // los códigos de error.
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth(JWT_SECURITY_SCHEME)
  @ApiOperation({
    summary:
      'Sortea y genera el cuadro del torneo, y lo pasa a `in_progress`. Las duplas sembradas van a sus posiciones protegidas y el resto se sortea; los byes caen en las sembradas. Cierra la inscripción: a partir de acá no se pueden agregar ni sacar duplas.',
  })
  @ApiCreatedResponse({ type: BracketResponseDto })
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
      'El torneo ya tiene cuadro (`bracket_already_exists`), no está abierto (`tournament_not_open`), tiene muy pocas o demasiadas duplas (`not_enough_teams` / `too_many_teams`, con `details.teamCount`), o las cabezas de serie no son `1..k` sin huecos (`invalid_seeding`, con `details.seeds`).',
  })
  generate(
    @ClubId() clubId: string,
    @Param() params: TournamentParamsDto,
  ): Promise<BracketResponseDto> {
    return this.bracketService.generate(clubId, params.tournamentId);
  }
}
