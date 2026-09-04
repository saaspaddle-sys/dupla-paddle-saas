import { ApiProperty } from '@nestjs/swagger';

/**
 * Los datos del jugador que necesita una tabla de inscriptos, y ni uno más.
 *
 * **Nunca sale `dni`** (Ley 25.326, regla dura y sin excepciones — ver
 * `players/dto/register-player-response.dto.ts`). Tampoco `email`,
 * `phone`, `emergencyPhone`, `birthDate` ni `userId`: el staff de un club
 * podría leer así los datos de contacto de cualquier jugador de la
 * plataforma con solo inscribirlo a un torneo propio. Los cuatro campos que
 * sí salen son exactamente los que la vista pública de jugadores va a
 * mostrar sin auth.
 */
export class PlayerSummaryDto {
  id!: string;
  firstName!: string;
  lastName!: string;

  /** Texto libre por ahora; `null` si el perfil no la tiene cargada. */
  @ApiProperty({ type: String, nullable: true })
  category!: string | null;
}

/**
 * La dupla inscripta. `player1`/`player2` vienen en orden canónico
 * (`player1.id < player2.id` como string), que puede no ser el orden en que
 * el cliente los mandó: es el orden que guarda la base para que (A, B) y
 * (B, A) sean la misma inscripción. La UI que quiera otro orden lo decide
 * ella.
 *
 * Sin `clubId`, por lo mismo que `TournamentResponseDto`. Sin `updatedAt`:
 * una dupla no se edita —se borra y se inscribe otra—, así que sería
 * siempre igual a `createdAt`.
 */
export class TeamResponseDto {
  id!: string;

  /** Redundante con el path, pero deja el objeto autocontenido en una lista. */
  @ApiProperty({ format: 'uuid' })
  tournamentId!: string;

  player1!: PlayerSummaryDto;
  player2!: PlayerSummaryDto;

  /** ISO 8601. Es el orden de inscripción. */
  createdAt!: string;
}
