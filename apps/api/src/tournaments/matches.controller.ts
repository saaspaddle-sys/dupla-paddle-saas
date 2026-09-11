import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ClubId } from '../auth/decorators/club-id.decorator';
import { ClubScopeGuard } from '../auth/guards/club-scope.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JWT_SECURITY_SCHEME, SWAGGER_TAGS } from '../swagger/swagger.setup';
import { MatchParamsDto } from './dto/match-params.dto';
import { MatchResultResponseDto } from './dto/match-result-response.dto';
import { RecordMatchResultDto } from './dto/record-match-result.dto';
import { MatchesService } from './matches.service';

/** Recurso propio: evita agregar un segundo nivel debajo de `tournaments`. */
@ApiTags(SWAGGER_TAGS.matches)
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Patch(':matchId/result')
  @UseGuards(JwtAuthGuard, ClubScopeGuard)
  @ApiBearerAuth(JWT_SECURITY_SCHEME)
  @ApiOperation({
    summary: 'Registra el resultado de un partido y avanza su ganador.',
  })
  @ApiOkResponse({ type: MatchResultResponseDto })
  @ApiBadRequestResponse({
    description: 'Parámetros o resultado inválidos (`validation`).',
  })
  @ApiUnauthorizedResponse({
    description: 'Sin sesión válida (`unauthenticated`).',
  })
  @ApiForbiddenResponse({
    description: 'La cuenta no administra un club (`club_required`).',
  })
  @ApiNotFoundResponse({
    description: 'El partido no existe o es de otro club (`match_not_found`).',
  })
  @ApiConflictResponse({
    description:
      'El torneo no está en curso, el partido no está listo o ya terminó, o el resultado no es consistente (`tournament_not_in_progress`, `match_not_ready`, `match_already_finished`, `invalid_match_result`).',
  })
  recordResult(
    @ClubId() clubId: string,
    @Param() params: MatchParamsDto,
    @Body() dto: RecordMatchResultDto,
  ): Promise<MatchResultResponseDto> {
    return this.matchesService.recordResult(clubId, params.matchId, dto);
  }
}
