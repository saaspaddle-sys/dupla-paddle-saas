import { PlayerGender } from '../../generated/prisma/enums';

export interface AuthenticatedUserPlayer {
  id: string;
  firstName: string;
  lastName: string;
  category: string | null;
  gender: PlayerGender | null;
}

/**
 * Lo que `JwtStrategy.validate()` deja en `request.user` — resuelto contra
 * la DB en cada request, nunca leído de los claims del token (el JWT solo
 * lleva `sub`; ver `docs/decisions.md`, entrada de sesión). `clubId` se
 * suma acá en el slice de tenant, y es de ahí — no del token ni del
 * request — de donde el futuro guard de club lee el `club_id`.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  player: AuthenticatedUserPlayer | null;
}
