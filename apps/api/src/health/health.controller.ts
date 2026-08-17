import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { API_TAGS } from '../swagger/swagger.setup';
import { HealthResponseDto } from './dto/health-response.dto';
import { HealthService } from './health.service';

/**
 * Endpoint operacional (`ops`), no de negocio: lo consume un orquestador
 * o un uptime monitor, no la web ni el panel del club. Sin auth a
 * propósito — un readiness probe corre antes de que exista una sesión, y
 * la respuesta no dice nada que no se pueda deducir mandando cualquier
 * request (arriba/abajo), sin host, credenciales ni detalle del driver.
 */
@ApiTags(API_TAGS.ops)
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Indica si la API puede alcanzar su base de datos',
  })
  @ApiOkResponse({ type: HealthResponseDto })
  @ApiServiceUnavailableResponse({
    description:
      'La base no responde (`database_unavailable`). El proceso está vivo — es exactamente el estado que un arranque limpio no distingue.',
  })
  async check(): Promise<HealthResponseDto> {
    if (!(await this.healthService.isDatabaseReachable())) {
      // 503 y no 500: el 500 dice "la API se rompió", y acá la API está
      // funcionando perfecto — lo que falta es una dependencia. La
      // diferencia es la que necesita un orquestador para decidir entre
      // sacar la instancia de rotación y reiniciarla.
      throw new ServiceUnavailableException({
        code: 'database_unavailable',
        message: 'the database is not reachable',
      });
    }

    return { status: 'ok', database: 'up' };
  }
}
