import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { TournamentStatus } from '../../generated/prisma/enums';

/** Cuántos torneos devuelve una página cuando el cliente no pide un tamaño. */
export const TOURNAMENTS_PAGE_SIZE_DEFAULT = 20;

/** Techo duro por página: nadie se lleva la tabla entera en un request. */
export const TOURNAMENTS_PAGE_SIZE_MAX = 100;

/**
 * Query de `GET /tournaments`. Sin `clubId`: el scope sale del usuario
 * autenticado y `forbidNonWhitelisted` convierte cualquier intento de
 * mandarlo en `400 validation`.
 *
 * Paginación por cursor y no por `page`/`offset`: la lista se ordena por
 * `id desc` (UUIDv7 es time-ordered, así que es orden de creación
 * descendente sin columna extra), y un torneo creado entre dos páginas
 * correría todas las filas hacia adelante con offset. Con `WHERE id <
 * cursor` la página siguiente no se mueve.
 */
export class ListTournamentsDto {
  /** Filtra por estado. Sin este campo devuelve los cuatro estados. */
  @IsOptional()
  @IsEnum(TournamentStatus, {
    message: 'status must be one of open, in_progress, finished or canceled',
  })
  status?: TournamentStatus;

  /** Tamaño de página, entre 1 y 100. Default 20. */
  @IsOptional()
  // La query llega como string y el `ValidationPipe` global corre con
  // `enableImplicitConversion: false`: sin este `@Type` el `@IsInt` de abajo
  // rechazaría cualquier `?limit=10`.
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(TOURNAMENTS_PAGE_SIZE_MAX, {
    message: `limit must be at most ${TOURNAMENTS_PAGE_SIZE_MAX}`,
  })
  limit?: number;

  /**
   * `id` del último item de la página anterior — el `nextCursor` de la
   * respuesta, que el cliente devuelve tal cual sin interpretarlo.
   */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'cursor must be a valid tournament id' })
  cursor?: string;
}
