import { ApiProperty } from '@nestjs/swagger';
import { TournamentResponseDto } from './tournament-response.dto';

/**
 * Página de torneos. `items` y `nextCursor` y no un array pelado: un array
 * en la raíz no tiene dónde colgar la paginación, y envolverlo después sería
 * un cambio de contrato incompatible (`docs/api-conventions.md`).
 *
 * A propósito **sin** `total`: contar el filtro completo en cada página es
 * una query extra que nadie pidió, y con cursor no hace falta para dibujar
 * "cargar más". Agregarlo más adelante es aditivo.
 */
export class TournamentListResponseDto {
  items!: TournamentResponseDto[];

  /**
   * `id` del último item de esta página, para pedir la siguiente como
   * `?cursor=<nextCursor>`. `null` cuando no hay más — es el fin de la
   * lista, no un error.
   */
  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  nextCursor!: string | null;
}
