import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { normalizeNameInput } from '../../common/transforms/normalize';
import { TournamentStatus } from '../../generated/prisma/enums';

/**
 * A propósito **no** se define con `PartialType(CreateTournamentDto)`: eso
 * arrastraría cada campo futuro de la creación a la superficie editable, que
 * es fail-open. Mismo criterio que `UpdateClubDto` y que los mappers
 * manuales.
 *
 * Los dos campos son independientes: se puede renombrar sin tocar el estado,
 * cambiar el estado sin tocar el nombre, o las dos cosas en el mismo request.
 * Un body vacío (`{}`) es un no-op que devuelve 200 con la representación
 * actual, igual que en `PATCH /clubs/me`.
 *
 * `status` acepta el enum completo y **no** solo `canceled`, aunque hoy la
 * única transición válida sea a `canceled`: qué transición se permite es una
 * regla de negocio con estado (depende del estado actual del torneo), y
 * codificarla como enum de entrada la convertiría en `400 validation` sin
 * poder decir desde dónde. Pedir `finished` o `in_progress` desde acá
 * devuelve `409 invalid_status_transition`, que es la respuesta que explica
 * qué pasó.
 */
export class UpdateTournamentDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeNameInput(value))
  @IsString({ message: 'name must be a string' })
  @MinLength(2, { message: 'name must be at least 2 characters' })
  @MaxLength(80, { message: 'name must be at most 80 characters' })
  @Matches(/\p{L}/u, { message: 'name must contain at least one letter' })
  name?: string;

  @IsOptional()
  @IsEnum(TournamentStatus, {
    message: 'status must be one of open, in_progress, finished or canceled',
  })
  status?: TournamentStatus;
}
