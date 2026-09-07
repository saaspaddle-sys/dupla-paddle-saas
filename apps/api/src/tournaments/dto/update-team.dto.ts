import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_TEAMS } from '../../matches/bracket.builder';

/**
 * Lo único editable de una dupla es su cabeza de serie. El par de jugadores
 * no se corrige: se borra la inscripción y se hace otra, porque cambiarlo
 * en el lugar mantendría el `id` de una dupla que ya no es la misma dupla.
 *
 * **`seed` distingue tres casos, y los tres importan**:
 *
 * - **ausente** (`{}`) — no-op. Devuelve 200 con la representación actual,
 *   igual que `PATCH /clubs/me` y `PATCH /tournaments/:id`.
 * - **`null`** — desiembra: la dupla vuelve al sorteo.
 * - **un entero** — la siembra en esa posición.
 *
 * Ausente y `null` llegan al service como `undefined` y `null`
 * respectivamente, que es lo que los hace distinguibles. No se usa
 * `'seed' in dto`: `class-transformer` define la propiedad igual cuando
 * falta en el body, así que ese chequeo daría `true` en los dos casos.
 *
 * `@IsOptional()` saltea las demás validaciones cuando el valor es `null` o
 * `undefined`, que es justo lo que hace falta para que `null` sea un valor
 * válido y no un `400`.
 */
export class UpdateTeamDto {
  /**
   * Desde 1, como el CHECK `teams_seed_positive` de la base: un seed 0 o
   * negativo no significa nada y no mapea contra ninguna posición del cuadro.
   *
   * El techo es el del cuadro más grande que el generador arma. No valida que
   * las cabezas sean `1..k` sin huecos —eso depende de las demás duplas y se
   * chequea al generar la llave, con `409 invalid_seeding`—, pero sí corta lo
   * absurdo acá en vez de dejarlo explotar recién en el `POST /bracket`.
   */
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 1,
    maximum: MAX_TEAMS,
    description:
      'Número de cabeza de serie. `null` desiembra la dupla; omitirlo no cambia nada.',
  })
  @IsOptional()
  @IsInt({ message: 'seed must be an integer' })
  @Min(1, { message: 'seed must be at least 1' })
  @Max(MAX_TEAMS, { message: `seed must be at most ${MAX_TEAMS}` })
  seed?: number | null;
}
