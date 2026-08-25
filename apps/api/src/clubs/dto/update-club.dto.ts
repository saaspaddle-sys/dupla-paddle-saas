import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { normalizeNameInput } from '../../common/transforms/normalize';

/**
 * A propósito **no** se define con `PartialType(CreateClubDto)`: eso
 * arrastraría automáticamente cada campo futuro de `CreateClubDto` a la
 * superficie editable, que es fail-open. Mismo criterio por el que los
 * mappers son manuales y no `ClassSerializerInterceptor`.
 *
 * `slug` no es editable en este slice, y es una decisión de
 * retrocompatibilidad, no un olvido: cambiarlo rompe cualquier URL pública
 * ya publicada y no hay tabla de redirects. Agregar un campo opcional de
 * entrada más adelante está permitido; sacarlo no.
 *
 * Un body vacío (`{}`) es un no-op que devuelve 200 con la representación
 * actual. No se rechaza: una regla de "al menos un campo" habría que
 * reescribirla cada vez que el DTO gane un campo.
 */
export class UpdateClubDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeNameInput(value))
  @IsString({ message: 'name must be a string' })
  @MinLength(2, { message: 'name must be at least 2 characters' })
  @MaxLength(80, { message: 'name must be at most 80 characters' })
  @Matches(/\p{L}/u, { message: 'name must contain at least one letter' })
  name?: string;
}
