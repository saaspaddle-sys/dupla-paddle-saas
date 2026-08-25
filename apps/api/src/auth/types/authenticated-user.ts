import { ClubStatus, PlayerGender } from '../../generated/prisma/enums';

export interface AuthenticatedUserPlayer {
  id: string;
  firstName: string;
  lastName: string;
  category: string | null;
  gender: PlayerGender | null;
}

export interface AuthenticatedUserClub {
  id: string;
  name: string;
  slug: string;
  status: ClubStatus;
}

/**
 * Lo que `JwtStrategy.validate()` deja en `request.user` — resuelto contra
 * la DB en cada request, nunca leído de los claims del token (el JWT solo
 * lleva `sub`; ver `docs/decisions.md`, entrada de sesión).
 *
 * `club` es de donde `ClubScopeGuard` lee el `club_id`: ni del token, ni
 * del request. `null` significa que la cuenta no es organizadora, en
 * simetría exacta con `player: null`.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  player: AuthenticatedUserPlayer | null;
  club: AuthenticatedUserClub | null;
}
