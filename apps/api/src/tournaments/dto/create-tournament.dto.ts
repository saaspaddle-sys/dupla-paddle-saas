import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { normalizeNameInput } from '../../common/transforms/normalize';

/**
 * Sin `clubId`: el scope sale de `@ClubId()`, o sea del usuario autenticado
 * (invariante de tenancy). Como el `ValidationPipe` global corre con
 * `forbidNonWhitelisted`, mandarlo en el body no es un campo ignorado en
 * silencio — es un `400 validation`.
 *
 * Sin `format` tampoco, y no es un olvido: `TournamentFormat` tiene un solo
 * valor (`single_elimination`) y la columna ya lo trae por default. Un campo
 * de entrada con un único valor válido es una decisión que el cliente no
 * puede tomar; se agrega —opcional, que es aditivo— cuando exista el segundo
 * formato.
 *
 * Sin `status`: todo torneo nace en `open`. Los cambios de estado se piden
 * por `PATCH`, que es donde vive la máquina de transiciones.
 */
export class CreateTournamentDto {
  @Transform(({ value }: { value: unknown }) => normalizeNameInput(value))
  @IsString({ message: 'name is required' })
  @MinLength(2, { message: 'name must be at least 2 characters' })
  @MaxLength(80, { message: 'name must be at most 80 characters' })
  // Al menos una letra, mismo criterio que `CreateClubDto`: descarta "--"
  // como nombre sin inventar una lista blanca de caracteres, porque los
  // nombres reales llevan números, `&` y paréntesis ("Apertura 2026 (7ma)").
  @Matches(/\p{L}/u, { message: 'name must contain at least one letter' })
  name!: string;
}
