import { ApiProperty } from '@nestjs/swagger';
import {
  MatchOutcome,
  MatchSlot,
  MatchStatus,
} from '../../generated/prisma/enums';
import { PlayerSummaryDto } from './team-response.dto';

/**
 * La dupla como la ve el cuadro. Es más chica que `TeamResponseDto` a
 * propósito: no repite `tournamentId` ni `createdAt`, que en un bracket son
 * ruido multiplicado por cada partido. Sí lleva `seed`, porque el número de
 * cabeza es lo que explica por qué una dupla se salteó la primera ronda.
 *
 * Reusa `PlayerSummaryDto`, así que hereda la misma garantía: **nunca sale el
 * `dni`**.
 */
export class BracketTeamDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: Number, nullable: true })
  seed!: number | null;

  player1!: PlayerSummaryDto;
  player2!: PlayerSummaryDto;
}

/**
 * Un partido del cuadro. El bracket se materializa entero al generar, así que
 * la mayoría de estos nacen vacíos: `teamA`/`teamB` en `null` son las rondas
 * futuras esperando ganadores, no un error.
 */
export class BracketMatchDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  /** 1 es la primera ronda que se juega, no la final. */
  round!: number;

  /** 0-based dentro de la ronda, de arriba hacia abajo. */
  position!: number;

  @ApiProperty({ type: BracketTeamDto, nullable: true })
  teamA!: BracketTeamDto | null;

  /** `null` en un bye: el lado que falta es siempre el B. */
  @ApiProperty({ type: BracketTeamDto, nullable: true })
  teamB!: BracketTeamDto | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  winnerTeamId!: string | null;

  @ApiProperty({ enum: MatchStatus })
  status!: MatchStatus;

  /**
   * `bye` lo escribe solo el generador. Un partido `pending` no tiene
   * outcome.
   */
  @ApiProperty({ enum: MatchOutcome, nullable: true })
  outcome!: MatchOutcome | null;

  /**
   * A qué partido avanza el ganador, y a qué lado. Los dos `null` **solo en
   * la final** — pero no derives "esto es la final" de eso: ver la entrada
   * del 2026-09-05 en `docs/decisions.md`.
   */
  @ApiProperty({ format: 'uuid', nullable: true })
  nextMatchId!: string | null;

  @ApiProperty({ enum: MatchSlot, nullable: true })
  nextSlot!: MatchSlot | null;
}

/**
 * El cuadro completo. `matches` viene ordenado por `(round asc, position
 * asc)`, que es el orden en que se dibuja de izquierda a derecha y de arriba
 * hacia abajo — el cliente no tiene que ordenar nada.
 *
 * Los tres números de arriba son derivables de `matches`, y salen igual
 * porque son lo que el frontend necesita para reservar el layout antes de
 * recorrer la lista: `bracketSize` da el alto del cuadro, `roundCount` el
 * ancho, y `byeCount` cuántos huecos va a encontrar en la primera columna.
 */
export class BracketResponseDto {
  @ApiProperty({ format: 'uuid' })
  tournamentId!: string;

  /** Potencia de 2 inmediatamente mayor o igual a la cantidad de duplas. */
  bracketSize!: number;

  roundCount!: number;

  /** Lugares vacíos del cuadro. Caen siempre en duplas sembradas. */
  byeCount!: number;

  @ApiProperty({ type: BracketMatchDto, isArray: true })
  matches!: BracketMatchDto[];
}
