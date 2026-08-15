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
 * `outcome` distingue si el registro creó un perfil nuevo o reclamó uno
 * que un club ya había cargado. Habilita "ya teníamos tu perfil, jugaste
 * N torneos" del lado de la UI — es el valor visible del dedup.
 *
 * Deliberadamente **no** es un eco del request ni una serialización de
 * `Player`: nunca incluye `dni` (Ley 25.326, regla dura y sin excepciones)
 * ni `passwordHash`.
 *
 * `firstName`/`lastName`/`category` sí salen, aunque en un claim puedan
 * ser datos que cargó el club (no lo que tipeó quien se registra — el
 * service nunca los pisa). No es una superficie nueva: son exactamente
 * los campos que la vista pública de jugadores va a mostrar sin auth
 * (`product-brief.md`, alcance 1 — "vista pública: torneos, llaves y
 * jugadores"). `player.email` y `player.birthDate` sí se excluyen: esos
 * no tienen lugar en la vista pública, y devolverlos convertiría el
 * endpoint en un lector de datos de contacto ajenos para cualquiera que
 * conozca un DNI.
 */
export class RegisterPlayerResponseDto {
  outcome!: 'created' | 'claimed';
  user!: RegisteredAccountDto;
  player!: RegisteredPlayerDto;
}
