import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { normalizeNameInput } from '../../common/transforms/normalize';

/**
 * Sin `ownerId`, `status`, `plan`, `maxTournaments` ni `subscription`:
 * ninguno es escribible por el cliente. El `owner_id` sale del usuario
 * autenticado, y como el `ValidationPipe` global corre con
 * `forbidNonWhitelisted`, mandar `ownerId` o `clubId` en el body no es un
 * campo ignorado en silencio — es un `400 validation`. El invariante de
 * tenancy queda enforceado por configuración que ya existe, no por
 * disciplina.
 *
 * **Sin `slug` tampoco**, y es deliberado: el server lo deriva de `name`.
 * Un slug elegido por el cliente sería una decisión permanente sobre algo
 * que hoy no puede ver ni corregir — no hay vista pública que lo muestre
 * (pregunta abierta 4) ni forma de editarlo después (pregunta abierta 3).
 * Agregarlo como campo opcional cuando esas dos tengan respuesta es
 * aditivo y sale gratis; sacarlo una vez shippeado costaría tres PRs
 * (`docs/decisions.md`, 2026-08-20).
 */
export class CreateClubDto {
  @Transform(({ value }: { value: unknown }) => normalizeNameInput(value))
  @IsString({ message: 'name is required' })
  @MinLength(2, { message: 'name must be at least 2 characters' })
  @MaxLength(80, { message: 'name must be at most 80 characters' })
  // Al menos una letra. Evita "--" como nombre de club sin inventar una
  // lista blanca de caracteres: los nombres reales llevan números, `&` y
  // paréntesis.
  @Matches(/\p{L}/u, { message: 'name must contain at least one letter' })
  name!: string;
}
