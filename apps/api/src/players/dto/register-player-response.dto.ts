import { ApiProperty } from '@nestjs/swagger';
import { PlayerGender } from '../../generated/prisma/enums';

export class RegisteredAccountDto {
  id!: string;
  email!: string;
}

export class RegisteredPlayerDto {
  id!: string;
  firstName!: string;
  lastName!: string;
  category!: string | null;
  gender!: PlayerGender | null;
  createdAt!: string;
}

/**
 * El registro crea la cuenta y el perfil en la misma transacción. Cuando el
 * DNI ya identifica un perfil sin dueño, el endpoint devuelve
 * `profile_claim_verification_required`: reclamarlo exige un flujo posterior
 * que pruebe control del email ya almacenado en ese perfil.
 *
 * Deliberadamente **no** es un eco del request ni una serialización de
 * `Player`: nunca incluye `dni` (Ley 25.326, regla dura y sin excepciones)
 * ni `passwordHash`.
 *
 * `firstName`/`lastName`/`category` sí salen. No es una superficie nueva:
 * son exactamente
 * los campos que la vista pública de jugadores va a mostrar sin auth
 * (`product-brief.md`, alcance 1 — "vista pública: torneos, llaves y
 * jugadores"). `player.email` y `player.birthDate` sí se excluyen: esos
 * no tienen lugar en la vista pública, y devolverlos convertiría el
 * endpoint en un lector de datos de contacto ajenos para cualquiera que
 * conozca un DNI.
 */
export class RegisterPlayerResponseDto {
  /** Siempre `created`; un claim se habilita en un flujo posterior. */
  @ApiProperty({ enum: ['created'], example: 'created' })
  outcome!: 'created';
  user!: RegisteredAccountDto;
  player!: RegisteredPlayerDto;
}
